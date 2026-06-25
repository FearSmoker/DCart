import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { publishRealtime } from "@/lib/realtime";
import { rateLimit } from "@/lib/rateLimit";

export const POST = async (request: NextRequest) => {
  try {
    const { orderId, email, reason } = await request.json();
    if (!orderId || !email) {
      return NextResponse.json({ success: false, message: "Missing orderId or email" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.email || session.user.email !== email) {
      return NextResponse.json({ success: false, message: "Unauthorized: Invalid session" }, { status: 401 });
    }

    // Rate limit: 5 return requests per minute per user
    try {
      const { success } = await rateLimit(`ratelimit:returnorder:${email}`, 5, 60);
      if (!success) {
        return NextResponse.json({ success: false, message: "Too Many Requests" }, { status: 429 });
      }
    } catch { /* non-critical if Redis is down */ }

    if (email) {
      const userDoc = await adminDB.collection("users").doc(email).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.role === "seller") {
          return NextResponse.json(
            { success: false, message: "Sellers are not allowed to manage consumer orders" },
            { status: 403 }
          );
        }
      }
    }

    const orderRef = adminDB.collection("users").doc(email).collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    const orderData = orderDoc.data();
    const orderValue = orderData?.value || {};

    if (orderValue.status === "Returned") {
      return NextResponse.json({ success: false, message: "Order is already returned" }, { status: 400 });
    }

    if (orderValue.return_status === "return_pending") {
      return NextResponse.json({ success: false, message: "Return request already submitted" }, { status: 400 });
    }

    if (orderValue.status !== "Delivered") {
      return NextResponse.json({ success: false, message: "Only delivered orders can be returned" }, { status: 400 });
    }

    const returnReason = reason || "No reason provided";
    const requestedAt = new Date().toISOString();

    // save return request — don't change value.status yet
    await orderRef.set(
      {
        value: {
          return_status: "return_pending",
          return_reason: returnReason,
          return_requested_at: requestedAt,
        },
      },
      { merge: true }
    );

    await publishRealtime({ type: "order:return_requested", data: { email, orderId, reason: returnReason } });

    return NextResponse.json({ success: true, message: "Return request submitted successfully" });
  } catch (error) {
    console.error("Return order error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
};
