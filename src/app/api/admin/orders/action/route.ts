import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { getSession } from "@/lib/manageSession";
import { publishEvent } from "@/lib/kafka";
import { publishRealtime } from "@/lib/realtime";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const { orderId, email, action } = await request.json();

    if (!orderId || !email || !["approve", "cancel"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    const orderRef = adminDB
      .collection("users")
      .doc(email)
      .collection("orders")
      .doc(orderId);

    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const orderData = orderSnap.data() as {
      value?: {
        amount?: number;
        items?: Array<{ _id: string; quantity: number; title?: string }>;
        status?: string;
      };
    };

    if (action === "approve") {
      // check for fraud
      await orderRef.update({ "value.status": "Paid" });
      try {
        await publishRealtime({ type: "analytics:updated", data: {} });
      } catch (err) {
        console.warn("Failed to publish realtime analytics update:", err);
      }
      return NextResponse.json({ success: true, message: "Order approved successfully" });
    }

    if (action === "cancel") {
      if (orderData.value?.status === "Dispatched") {
        return NextResponse.json({ success: false, error: "Dispatched orders cannot be cancelled" }, { status: 400 });
      }
      // change status to "cancelled as fraud"
      await orderRef.update({ "value.status": "Cancelled as Fraud" });

      // stock handled by kafka
      const items = orderData.value?.items || [];
      if (items.length > 0) {
        await publishEvent("order-cancelled", {
          orderId,
          email,
          amount: orderData.value?.amount || 0,
          items,
        });
      }

      try {
        await publishRealtime({ type: "analytics:updated", data: {} });
      } catch (err) {
        console.warn("Failed to publish realtime analytics update:", err);
      }

      return NextResponse.json({ success: true, message: "Order cancelled and stock restored" });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin order action error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
