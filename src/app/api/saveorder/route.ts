import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { publishEvent } from "@/lib/kafka";
import { redis } from "@/lib/redis";
import { publishRealtime } from "@/lib/realtime";
import Stripe from "stripe";

export const POST = async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateKey = `ratelimit:saveorder:${ip}`;

  try {
    const { success, remaining } = await rateLimit(rateKey, 10, 60); // 10 requests per minute
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Too Many Requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }
  } catch (err) {
    console.error("Rate limiting error on saveorder:", err);
  }

  try {
    const reqBody = await request.json();
    const { cart, email, id, totalAmt } = await reqBody;

    const session = await auth();
    if (!session?.user?.email || session.user.email !== email) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Invalid or missing session" },
        { status: 401 }
      );
    }

    // Check user order frequency in the last 24h
    const freqKey = `dcart:user:orderfreq:${email}`;
    let freq = 1;
    try {
      const currentFreq = await redis.incr(freqKey);
      if (currentFreq === 1) {
        await redis.expire(freqKey, 86400); // 24h expiry
      }
      freq = currentFreq;
    } catch (err) {
      console.warn("Failed to increment user order frequency:", err);
    }

    // Rolling 2-minute window checking
    const nowMs = Date.now();
    const rollingKey = `dcart:user:order2min_timestamps:${email}`;
    let uniqueOrdersIn2Min = 1;
    try {
      await redis.rpush(rollingKey, String(nowMs));
      const allTimestamps = await redis.lrange(rollingKey, 0, -1);
      const twoMinAgo = nowMs - 120000;
      const validTimestamps = allTimestamps.filter((ts) => Number(ts) >= twoMinAgo);
      
      await redis.del(rollingKey);
      if (validTimestamps.length > 0) {
        await redis.rpush(rollingKey, ...validTimestamps);
        await redis.expire(rollingKey, 120);
      }
      uniqueOrdersIn2Min = validTimestamps.length;
    } catch (err) {
      console.warn("Failed to update rolling 2-min orders:", err);
      uniqueOrdersIn2Min = freq;
    }

    // Item quantities checking
    const totalItemsQuantity = (cart || []).reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 1), 0);
    const isSingleProduct = (cart || []).length === 1;
    const isMultiProduct = (cart || []).length > 1;

    const freqLimitExceeded = uniqueOrdersIn2Min >= 6;
    const multiProductLimitExceeded = isMultiProduct && totalItemsQuantity > 10;
    const singleProductLimitExceeded = isSingleProduct && totalItemsQuantity > 6;

    // Fraud check rules
    const isFraud = freqLimitExceeded || multiProductLimitExceeded || singleProductLimitExceeded;
    const status = isFraud ? "Flagged Fraud" : "Paid";

    let shippingAddress = null;
    if (id && (id.startsWith("cs_") || id.startsWith("checkout_session_"))) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
        const stripeSession = await stripe.checkout.sessions.retrieve(id);
        const metadata = stripeSession.metadata || {};
        if (metadata.shipping_street) {
          shippingAddress = {
            name: metadata.shipping_name || "",
            contactNo: metadata.shipping_contact || "",
            street: metadata.shipping_street || "",
            city: metadata.shipping_city || "",
            state: metadata.shipping_state || "",
            zipCode: metadata.shipping_zip || "",
            label: metadata.shipping_label || "Home",
          };
        }
      } catch (err) {
        console.warn("Failed to retrieve Stripe session metadata for order:", id, err);
      }
    }

    const orderItem = {
      amount: totalAmt,
      items: cart || [],
      status,
      ...(shippingAddress ? { shippingAddress } : {}),
    };

    if (cart.length) {
      // Save order to Firestore
      const userOrdersRef = adminDB
        .collection("users")
        .doc(email)
        .collection("orders")
        .doc(id);
      const userDoc = await userOrdersRef.get();
      if (!userDoc?.exists) {
        await userOrdersRef.set({ email });
      }

      await userOrdersRef.set({ value: orderItem }, { merge: true });

      // If fraud, log threat to Redis list dcart:security:threat_logs
      if (isFraud) {
        const uAgent = request.headers.get("user-agent") || "Web Browser";
        let deviceSummary = "Web Browser";
        if (uAgent.includes("iPhone") || uAgent.includes("iPad")) {
          deviceSummary = "Mobile App (iOS)";
        } else if (uAgent.includes("Android")) {
          deviceSummary = "Mobile Browser (Android)";
        } else if (uAgent.includes("curl") || uAgent.includes("Postman")) {
          deviceSummary = "Bot / curl script";
        }

        const threatLog = {
          id: `TX-${id.slice(-4).toUpperCase()}`,
          timestamp: new Date().toLocaleTimeString(),
          amount: totalAmt,
          location: ip === "127.0.0.1" || ip === "::1" ? "Localhost" : "India (IN)",
          device: deviceSummary,
          frequency: uniqueOrdersIn2Min,
          probability: freqLimitExceeded ? 0.95 : 0.85,
          riskLevel: freqLimitExceeded ? "High" : "Medium",
        };

        try {
          await redis.lpush("dcart:security:threat_logs", JSON.stringify(threatLog));
          await redis.ltrim("dcart:security:threat_logs", 0, 99);
        } catch (err) {
          console.warn("Failed to save threat log to Redis:", err);
        }
      }

      // Decrement inventory/stock in Redis
      for (const item of cart) {
        const stockKey = `dcart:stock:${item._id}`;
        try {
          const newStock = await redis.decrby(stockKey, item.quantity || 1);
          if (newStock < 0) {
            await redis.set(stockKey, "0");
          }
        } catch (err) {
          console.warn("Failed to decrement stock in Redis for product:", item._id, err);
        }
      }

      // Update sales/order analytics in Redis
      try {
        await redis.incr("dcart:analytics:total_orders");
        await redis.incrbyfloat("dcart:analytics:total_revenue", totalAmt);

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        await redis.hincrby(`dcart:analytics:daily_sales:${dateStr}`, "orders", 1);
        await redis.hincrbyfloat(`dcart:analytics:daily_sales:${dateStr}`, "revenue", totalAmt);
      } catch (err) {
        console.warn("Failed to update analytics in Redis:", err);
      }

      // Publish events to event bus
      try {
        await publishEvent("order-created", {
          orderId: id,
          email,
          amount: totalAmt,
          items: cart.map((item: { _id: string; quantity: number; title: string }) => ({
            _id: item._id,
            quantity: item.quantity || 1,
            title: item.title,
          })),
        });

        await publishEvent("payment-success", {
          orderId: id,
          email,
          amount: totalAmt,
        });
      } catch (err) {
        console.error("Failed to publish order/payment events:", err);
      }

      try {
        await publishRealtime({
          type: "order:created",
          data: { email, orderId: id, amount: totalAmt }
        });
        await publishRealtime({ type: "analytics:updated", data: {} });
      } catch (err) {
        console.warn("Failed to publish realtime order:created/analytics update:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: isFraud ? "Order submitted (flagged for fraud review)" : "Order saved successfully",
      status,
    });
  } catch (error) {
    console.error("Error in saveorder API:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error",
    });
  }
};