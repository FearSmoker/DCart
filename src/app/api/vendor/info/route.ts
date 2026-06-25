import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";

export const revalidate = 60; // cache for 1 minute

// public: returns store name and join date for a vendor (used on product pages)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendor_id");

    if (!vendorId) {
      return NextResponse.json({ success: false, error: "vendor_id required" }, { status: 400 });
    }

    const vendorDoc = await adminDB.collection("vendors").doc(vendorId).get();
    if (!vendorDoc.exists) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const data = vendorDoc.data();
    return NextResponse.json({
      success: true,
      store_name: data?.store_name || "DCart Seller",
      created_at: data?.created_at || data?.createdDate || null,
    });
  } catch (error) {
    console.error("[Vendor Info] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to load vendor info" }, { status: 500 });
  }
}
