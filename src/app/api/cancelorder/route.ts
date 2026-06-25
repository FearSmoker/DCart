import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { publishEvent } from "@/lib/kafka";
import { publishRealtime } from "@/lib/realtime";
import { rateLimit } from "@/lib/rateLimit";

export const POST = async (request: NextRequest) => {
  try {
    const { orderId, email } = await request.json();
    if (!orderId || !email) {
      return NextResponse.json({ success: false, message: "Missing orderId or email" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.email || session.user.email !== email) {
      return NextResponse.json({ success: false, message: "Unauthorized: Invalid session" }, { status: 401 });
    }

    // Rate limit: 5 cancel attempts per minute per user
    try {
      const { success } = await rateLimit(`ratelimit:cancelorder:${email}`, 5, 60);
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
            { success: false, message: "Sellers are not allowed to cancel or manage consumer orders" },
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

    if (orderValue.status === "Cancelled") {
      return NextResponse.json({ success: false, message: "Order is already cancelled" }, { status: 400 });
    }

    if (orderValue.status === "Dispatched") {
      return NextResponse.json({ success: false, message: "Dispatched orders cannot be cancelled" }, { status: 400 });
    }

    if (orderValue.status === "Delivered" || orderValue.status === "Returned") {
      return NextResponse.json({ success: false, message: "Delivered or returned orders cannot be cancelled" }, { status: 400 });
    }

    await orderRef.set({ value: { status: "Cancelled" } }, { merge: true });

    await publishEvent("order-cancelled", {
      orderId,
      email,
      amount: orderValue.amount || 0,
      items: (orderValue.items || []).map((item: { _id: string; quantity: number; title: string }) => ({
        _id: item._id,
        quantity: item.quantity || 1,
        title: item.title,
      })),
    });

    await publishRealtime({ type: "order:cancelled", data: { email, orderId } });
    await publishRealtime({ type: "analytics:updated", data: {} });

    return NextResponse.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Cancel order error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
};
