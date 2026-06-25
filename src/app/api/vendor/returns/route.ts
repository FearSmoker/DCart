import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { publishRealtime } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: fetch pending/seller-rejected returns for this vendor
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { role, vendorId: userVendorId } = session.user as { role?: string; vendorId?: string };
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendor_id");

    if (!vendorId) {
      return NextResponse.json({ success: false, error: "vendor_id required" }, { status: 400 });
    }

    if (role !== "admin" && (role !== "seller" || userVendorId !== vendorId)) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const productsSnap = await adminDB
      .collection("products")
      .where("vendorId", "==", vendorId)
      .get();

    const vendorProductIds = new Set(productsSnap.docs.map((d) => d.id));

    if (vendorProductIds.size === 0) {
      return NextResponse.json({ success: true, returns: [] });
    }

    const allOrdersSnap = await adminDB.collectionGroup("orders").get();

    interface ReturnRequest {
      id: string;
      email: string;
      amount: number;
      items: Array<{ _id?: string; title?: string; quantity?: number; price?: number }>;
      return_reason: string;
      return_requested_at: string;
      return_status: string;
      order_status: string;
      seller_rejection_reason?: string;
    }

    const returns: ReturnRequest[] = [];

    for (const doc of allOrdersSnap.docs) {
      const data = doc.data() as {
        value?: {
          status?: string;
          return_status?: string;
          return_reason?: string;
          return_requested_at?: string;
          seller_rejection_reason?: string;
          amount?: number;
          items?: Array<{ _id?: string; title?: string; quantity?: number; price?: number }>;
        };
      };

      const returnStatus = data.value?.return_status;
      if (returnStatus !== "return_pending" && returnStatus !== "return_seller_rejected") continue;

      const items = data.value?.items || [];
      const hasVendorItem = items.some((item) => vendorProductIds.has(item._id || ""));
      if (!hasVendorItem) continue;

      const email = doc.ref.parent.parent?.id || "";
      returns.push({
        id: doc.id,
        email,
        amount: data.value?.amount || 0,
        items,
        return_reason: data.value?.return_reason || "",
        return_requested_at: data.value?.return_requested_at || "",
        return_status: returnStatus,
        order_status: data.value?.status || "",
        seller_rejection_reason: data.value?.seller_rejection_reason,
      });
    }

    returns.sort((a, b) => b.return_requested_at.localeCompare(a.return_requested_at));

    return NextResponse.json({ success: true, returns });
  } catch (error) {
    console.error("[Vendor Returns GET] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// POST: vendor approve or reject a return request
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { role, vendorId: userVendorId } = session.user as { role?: string; vendorId?: string };
    if (role !== "seller" && role !== "admin") {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const { orderId, email, action, rejectionReason, vendorId } = await request.json();

    if (!orderId || !email || !vendorId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    if (role === "seller" && userVendorId !== vendorId) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const orderRef = adminDB.collection("users").doc(email).collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const orderData = orderSnap.data();

    if (action === "approve") {
      await orderRef.update({
        "value.return_status": "return_approved",
        "value.status": "Dispatched for Return",
        "value.return_approved_at": new Date().toISOString(),
      });

      // restore stock
      const items = orderData?.value?.items || [];
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

      await publishRealtime({
        type: "order:return_dispatched",
        data: { email, orderId },
      });
      await publishRealtime({ type: "analytics:updated", data: {} });

      return NextResponse.json({ success: true, message: "Return approved. Order marked as Dispatched for Return." });
    }

    if (action === "reject") {
      // escalate to admin
      await orderRef.update({
        "value.return_status": "return_seller_rejected",
        "value.seller_rejection_reason": rejectionReason || "Rejected by seller",
        "value.seller_rejected_at": new Date().toISOString(),
      });

      await adminDB.collection("admin_returns").add({
        orderId,
        email,
        vendorId,
        return_reason: orderData?.value?.return_reason || "",
        seller_rejection_reason: rejectionReason || "Rejected by seller",
        return_requested_at: orderData?.value?.return_requested_at || "",
        seller_rejected_at: new Date().toISOString(),
        escalated_at: new Date().toISOString(),
        status: "escalated",
      });

      await publishRealtime({
        type: "order:return_seller_rejected",
        data: { email, orderId, vendorId },
      });

      return NextResponse.json({ success: true, message: "Return rejected and escalated to admin." });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Vendor Returns POST] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
