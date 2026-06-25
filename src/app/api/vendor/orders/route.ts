import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { auth } from "@/auth";

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

    let targetVendorId = vendorId;
    if (role === "seller") {
      if (!userVendorId) {
        return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
      }
      targetVendorId = userVendorId;
    } else if (role !== "admin") {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const snapshot = await adminDB.collectionGroup("orders").get();
    let orders = snapshot.docs.map((doc) => {
      const email = doc.ref.parent.parent?.id || "";
      return {
        id: doc.id,
        email,
        ...doc.data(),
      };
    });

    // ── if targetvendorid is provided, filter...
    // items that belong to this vendor's...
    if (targetVendorId) {
      // fetch the vendor's product ids from firestore
      let vendorProductIds: Set<string> = new Set();
      try {
        const productsSnap = await adminDB
          .collection("products")
          .where("vendorId", "==", targetVendorId)
          .get();
        vendorProductIds = new Set(productsSnap.docs.map((d) => d.id));
      } catch (err) {
        console.warn("[Vendor Orders] Failed to fetch vendor product IDs:", err);
      }

      if (vendorProductIds.size > 0) {
        // keep only orders that contain at...
        orders = orders.filter((order) => {
          const items: Array<{ _id: string }> = (order as { value?: { items?: Array<{ _id: string }> } }).value?.items ?? [];
          return items.some((item) => vendorProductIds.has(item._id));
        });
      }
      // if vendorproductids is empty (no products...
      else {
        orders = [];
      }
    }

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Failed to fetch vendor orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vendor orders" },
      { status: 500 }
    );
  }
}
