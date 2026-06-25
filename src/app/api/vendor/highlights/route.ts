import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";

export const revalidate = 0;

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
      return NextResponse.json({ success: false, error: "Missing vendor_id" }, { status: 400 });
    }

    if (role !== "admin" && (role !== "seller" || userVendorId !== vendorId)) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const vendorDoc = await adminDB.collection("vendors").doc(vendorId).get();
    if (!vendorDoc.exists) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const data = vendorDoc.data();
    const created_at = data?.created_at || data?.createdDate || "";

    // count orders containing this vendor's products
    let totalOrders = 0;
    try {
      const productsSnap = await adminDB
        .collection("products")
        .where("vendorId", "==", vendorId)
        .get();
      const vendorProductIds = new Set(productsSnap.docs.map((d) => d.id));

      if (vendorProductIds.size > 0) {
        const ordersSnapshot = await adminDB.collectionGroup("orders").get();
        ordersSnapshot.docs.forEach((doc) => {
          const orderData = doc.data();
          const items = orderData?.value?.items || [];
          const hasVendorProduct = items.some((item: { _id?: string; id?: string }) => {
            const itemId = item._id || item.id || "";
            return vendorProductIds.has(itemId);
          });
          if (hasVendorProduct) {
            totalOrders++;
          }
        });
      }
    } catch (err) {
      console.warn("[Vendor Highlights API] Failed to count vendor orders:", err);
    }

    return NextResponse.json({
      success: true,
      created_at,
      total_orders: totalOrders,
    });
  } catch (error) {
    console.error("Error fetching vendor highlights:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
