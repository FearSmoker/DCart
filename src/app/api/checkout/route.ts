import { auth } from "@/auth";
import { ProductData } from "@/types";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/rateLimit";

export const POST = async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateKey = `ratelimit:checkout:${ip}`;

  try {
    const { success, remaining } = await rateLimit(rateKey, 10, 60); // 10 requests per minute
    if (!success) {
      return NextResponse.json(
        { error: "Too Many Requests. Please try again later." },
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
    console.error("Rate limiting error on checkout:", err);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

  try {
    const reqBody = await request.json();
    const { items, email, isBuyNow, address } = await reqBody;

    const session = await auth();
    if (!session?.user?.email || session.user.email !== email) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    if (email) {
      const { adminDB } = await import("@/firebaseAdmin");
      const userDoc = await adminDB.collection("users").doc(email).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.role === "seller") {
          return NextResponse.json(
            { error: "Sellers are not allowed to purchase products or check out" },
            { status: 403 }
          );
        }
      }
    }

    const extractingItems = await items.map((item: ProductData) => ({
      quantity: item?.quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item?.title,
          description: item?.description,
          // images: item?.image,
        },
      },
    }));
    // Use the server-configured app URL — never trust the client-sent Origin header
    // for Stripe redirect URLs, as it could be manipulated in a phishing scenario.
    const appUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://dcart.vercel.app";

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: extractingItems,
      mode: "payment",
      success_url: `${appUrl}/success/?session_id={CHECKOUT_SESSION_ID}${isBuyNow ? "&buynow=true" : ""}`,
      cancel_url: `${appUrl}/cancel/?canceled=true`,
      metadata: {
        email,
        shipping_name: address?.name || "",
        shipping_contact: address?.contactNo || "",
        shipping_street: address?.street || "",
        shipping_city: address?.city || "",
        shipping_state: address?.state || "",
        shipping_zip: address?.zipCode || "",
        shipping_label: address?.label || "",
      },
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("[Checkout] Error creating Stripe session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
};
