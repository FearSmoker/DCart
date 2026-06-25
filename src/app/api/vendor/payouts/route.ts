import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";

export const dynamic = "force-dynamic";
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
      return NextResponse.json({ success: false, error: "vendor_id required" }, { status: 400 });
    }

    if (role !== "admin" && (role !== "seller" || userVendorId !== vendorId)) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const payoutsSnap = await adminDB
      .collection("vendors")
      .doc(vendorId)
      .collection("payouts")
      .orderBy("approvedAt", "desc")
      .get();

    const payouts = payoutsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, payouts });
  } catch (error) {
    console.error("[Vendor Payouts GET] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
