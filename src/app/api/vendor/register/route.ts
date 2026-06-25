import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";

export const revalidate = 0;

interface VendorRegistration {
  name: string;
  email: string;
  storeName: string;
  storeDescription: string;
  phone: string;
  category: string;
  gstNumber?: string;
  bankAccount?: string;
}

const COMMISSION_RATES: Record<string, number> = {
  electronics: 0.08,
  laptops: 0.08,
  phones: 0.10,
  audio: 0.12,
  accessories: 0.15,
  sports: 0.10,
  streetwear: 0.12,
  fashion: 0.12,
  home: 0.10,
  books: 0.08,
  default: 0.10,
};

function getCommissionRate(category: string): number {
  const cat = category.toLowerCase();
  for (const [key, rate] of Object.entries(COMMISSION_RATES)) {
    if (cat.includes(key)) return rate;
  }
  return COMMISSION_RATES.default;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const sessionEmail = session.user.email;

    const body = await request.json() as VendorRegistration;
    const { name, storeName, storeDescription, phone, category, gstNumber } = body;

    const email = sessionEmail;

    if (!name || !email || !storeName || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, email, storeName, category" },
        { status: 400 }
      );
    }

    const vendorId = `vendor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const commissionRate = getCommissionRate(category);

    const vendorData = {
      vendor_id: vendorId,
      name,
      email,
      store_name: storeName,
      store_description: storeDescription || "",
      phone: phone || "",
      primary_category: category,
      gst_number: gstNumber || "",
      commission_rate: commissionRate,
      status: "pending", // pending | approved | rejected
      approved: false,
      balance: 0,
      total_revenue: 0,
      total_orders: 0,
      rating: 0,
      product_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // save to firestore
    await adminDB
      .collection("vendors")
      .doc(vendorId)
      .set(vendorData);

    // also create vendor's sub-collections stubs
    await adminDB
      .collection("vendors")
      .doc(vendorId)
      .collection("products")
      .doc("placeholder")
      .set({ initialized: true });

    return NextResponse.json({
      success: true,
      vendor_id: vendorId,
      message: "Vendor registration submitted! Your application is under review (1-2 business days).",
      commission_rate: commissionRate,
      status: "pending",
    });
  } catch (error) {
    console.error("Vendor registration error:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed. Please try again later." },
      { status: 503 }
    );
  }
}

export async function GET() {
  // admin: list all vendors
  try {
    const session = await auth();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const snapshot = await adminDB.collection("vendors").get();
    const vendors = snapshot.docs
      .filter((d) => d.id !== "__placeholder__")
      .map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ success: true, vendors, total: vendors.length });
  } catch (error) {
    console.error("Vendor list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vendor list" },
      { status: 503 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  // admin: approve/reject vendor
  try {
    const session = await auth();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const { vendor_id, action } = await request.json() as { vendor_id: string; action: "approve" | "reject" };
    
    // update vendor document
    await adminDB.collection("vendors").doc(vendor_id).update({
      approved: action === "approve",
      status: action === "approve" ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    });

    // update corresponding user document
    const vendorSnap = await adminDB.collection("vendors").doc(vendor_id).get();
    if (vendorSnap.exists) {
      const vendorData = vendorSnap.data();
      if (vendorData?.email) {
        const userRef = adminDB.collection("users").doc(vendorData.email);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          await userRef.update({
            role: "seller",
            sellerStatus: action === "approve" ? "approved" : "rejected",
            vendorId: vendor_id,
          });
        }
      }
    }

    return NextResponse.json({ success: true, vendor_id, status: action === "approve" ? "approved" : "rejected" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
