import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { getSession } from "@/lib/manageSession";
import { publishRealtime } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: fetch escalated returns needing admin decision
export async function GET() {
  try {
    const session = await getSession();
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const escalatedSnap = await adminDB
      .collection("admin_returns")
      .orderBy("escalated_at", "desc")
      .get();

    interface AdminReturnRecord {
      id: string;
      orderId: string;
      email: string;
      vendorId: string;
      return_reason: string;
      seller_rejection_reason: string;
      return_requested_at: string;
      seller_rejected_at: string;
      escalated_at: string;
      status: string;
      admin_decision?: string;
      admin_decided_at?: string;
      order_amount?: number;
      order_items?: Array<{ _id?: string; title?: string; quantity?: number; price?: number }>;
      store_name?: string;
    }

    const returns: AdminReturnRecord[] = [];

    // build vendorId → store_name map
    const vendorsSnap = await adminDB.collection("vendors").get();
    const vendorMap: Record<string, string> = {};
    vendorsSnap.docs.forEach((doc) => {
      vendorMap[doc.id] = doc.data().store_name || doc.id;
    });

    for (const doc of escalatedSnap.docs) {
      const data = doc.data() as AdminReturnRecord;

      let order_amount = 0;
      let order_items: AdminReturnRecord["order_items"] = [];
      try {
        const orderSnap = await adminDB
          .collection("users")
          .doc(data.email)
          .collection("orders")
          .doc(data.orderId)
          .get();
        if (orderSnap.exists) {
          order_amount = orderSnap.data()?.value?.amount || 0;
          order_items = orderSnap.data()?.value?.items || [];
        }
      } catch { /* ignore */ }

      const { id: _docId, ...restData } = data as AdminReturnRecord & { id?: string };
      void _docId;
      returns.push({
        id: doc.id,
        ...restData,
        order_amount,
        order_items,
        store_name: vendorMap[data.vendorId] || data.vendorId,
      });
    }

    return NextResponse.json({ success: true, returns });
  } catch (error) {
    console.error("[Admin Returns GET] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// POST: admin approve or decline an escalated return
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const { adminReturnId, orderId, email, vendorId, action } = await request.json();

    if (!adminReturnId || !orderId || !email || !vendorId || !["approve", "decline"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    const orderRef = adminDB.collection("users").doc(email).collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const adminReturnRef = adminDB.collection("admin_returns").doc(adminReturnId);

    if (action === "approve") {
      await orderRef.update({
        "value.status": "Returned",
        "value.return_status": "return_admin_approved",
        "value.returned_at": new Date().toISOString(),
      });

      // restore stock
      const items = orderSnap.data()?.value?.items || [];
      for (const item of items) {
        const productId = item._id || item.id;
        if (!productId) continue;
        const productRef = adminDB.collection("products").doc(productId);
        const productSnap = await productRef.get();
        if (!productSnap.exists) continue;
        const currentQty = productSnap.data()?.quantity || 0;
        const returnQty = item.quantity || 1;
        await productRef.update({ quantity: currentQty + returnQty });
        await publishRealtime({
          type: "inventory:updated",
          data: { productId, stock: currentQty + returnQty },
        });
      }

      await adminReturnRef.update({
        status: "admin_approved",
        admin_decision: "approved",
        admin_decided_at: new Date().toISOString(),
        admin_email: session?.user?.email,
      });

      await publishRealtime({ type: "order:returned", data: { email, orderId } });
      await publishRealtime({ type: "analytics:updated", data: {} });

      return NextResponse.json({ success: true, message: "Return approved. Order marked as Returned." });
    }

    if (action === "decline") {
      // decline: order stays Delivered, return closed
      await orderRef.update({
        "value.return_status": "return_admin_declined",
        "value.admin_declined_at": new Date().toISOString(),
      });

      await adminReturnRef.update({
        status: "admin_declined",
        admin_decision: "declined",
        admin_decided_at: new Date().toISOString(),
        admin_email: session?.user?.email,
      });

      await publishRealtime({
        type: "order:return_admin_declined",
        data: { email, orderId },
      });

      return NextResponse.json({ success: true, message: "Return declined. Order remains as Delivered." });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Admin Returns POST] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
