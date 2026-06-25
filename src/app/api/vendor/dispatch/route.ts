import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { publishEvent } from "@/lib/kafka";
import { publishRealtime } from "@/lib/realtime";
import { redis } from "@/lib/redis";

export const POST = async (request: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { role, vendorId } = session.user as { role?: string; vendorId?: string };
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json({ success: false, message: "Access Denied" }, { status: 403 });
    }

    const { orderId, email } = await request.json();

    if (!orderId || !email) {
      return NextResponse.json(
        { success: false, message: "Missing orderId or email" },
        { status: 400 }
      );
    }

    const orderRef = adminDB
      .collection("users")
      .doc(email)
      .collection("orders")
      .doc(orderId);

    const docSnap = await orderRef.get();
    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    if (role === "seller") {
      if (!vendorId) {
        return NextResponse.json({ success: false, message: "Access Denied: No vendor account" }, { status: 403 });
      }
      const orderData = docSnap.data();
      const items = orderData?.value?.items || [];
      let ownsProduct = false;
      for (const item of items) {
        const productId = item._id || item.id;
        if (productId) {
          const productDoc = await adminDB.collection("products").doc(productId).get();
          if (productDoc.exists && productDoc.data()?.vendorId === vendorId) {
            ownsProduct = true;
            break;
          }
        }
      }
      if (!ownsProduct) {
        return NextResponse.json({ success: false, message: "Access Denied: Order does not contain your products" }, { status: 403 });
      }
    }

    const dispatchedAt = new Date().toISOString();

    await orderRef.update({
      "value.status": "Dispatched",
      "value.dispatched_at": dispatchedAt,
    });

    // decrement stock per dispatched item
    const orderItems: Array<{ _id?: string; id?: string; quantity?: number }> = docSnap.data()?.value?.items || [];
    for (const item of orderItems) {
      const productId = item._id || item.id;
      if (!productId) continue;
      const productRef = adminDB.collection("products").doc(productId);
      const productSnap = await productRef.get();
      if (!productSnap.exists) continue;
      const currentQty = Number(productSnap.data()?.quantity ?? 0);
      const dispatchQty = Number(item.quantity ?? 1);
      const newQty = Math.max(0, currentQty - dispatchQty);
      await productRef.update({ quantity: newQty });
      try {
        const { publishRealtime: realtimePublish } = await import("@/lib/realtime");
        await realtimePublish({ type: "inventory:updated", data: { productId, stock: newQty } });
      } catch { /* non-critical */ }
    }

    // TTL 5 min — auto-deliver cron picks this up
    await redis.setex(
      `dcart:pending_delivery:${orderId}`,
      300,
      JSON.stringify({ orderId, email, dispatchedAt })
    );

    // sorted set for cron fallback scanning
    await redis.zadd(
      "dcart:dispatched_orders",
      Date.now(),
      `${orderId}:${email}`
    );

    try {
      await publishEvent("order-dispatched", {
        orderId,
        email,
        status: "Dispatched",
        timestamp: dispatchedAt,
      });
      await publishRealtime({
        type: "order:dispatched",
        data: { email, orderId },
      });
      await publishRealtime({ type: "analytics:updated", data: {} });
    } catch (err) {
      console.error("Failed to publish dispatch event:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Order dispatched successfully. Will auto-deliver in 5 minutes.",
    });
  } catch (error) {
    console.error("Error dispatching order:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error",
    });
  }
};
