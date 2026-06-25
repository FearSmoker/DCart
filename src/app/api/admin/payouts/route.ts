import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { getSession } from "@/lib/manageSession";
import { publishRealtime } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COMMISSION_RATES: Record<string, number> = {
  electronics: 0.08,
  laptops: 0.08,
  phones: 0.10,
  audio: 0.12,
  accessories: 0.15,
  sports: 0.10,
  fashion: 0.12,
  home: 0.10,
  books: 0.08,
  other: 0.10
};

const getCommissionRate = (product: any): number => {
  if (!product) return 0.10;
  const categories = product.category;
  if (!categories) return 0.10;
  const categoryList: string[] = Array.isArray(categories)
    ? categories.map((c: any) => typeof c === "string" ? c : c.name || "")
    : [typeof categories === "string" ? categories : categories.name || ""];
  for (const cat of categoryList) {
    const normCat = cat.toLowerCase().trim();
    for (const [key, rate] of Object.entries(COMMISSION_RATES)) {
      if (normCat.includes(key)) {
        return rate;
      }
    }
  }
  return 0.10;
};

// get — fetch all delivered orders...
export async function GET() {
  try {
    const session = await getSession();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    // fetch all vendor profiles for name lookup
    const vendorsSnap = await adminDB.collection("vendors").get();
    const vendorMap: Record<string, { store_name?: string; email?: string; commission_rate?: number }> = {};
    vendorsSnap.docs.forEach((doc) => {
      vendorMap[doc.id] = doc.data() as { store_name?: string; email?: string; commission_rate?: number };
    });

    // fetch all products to map productid → vendorid
    const productsSnap = await adminDB.collection("products").get();
    const productVendorMap: Record<string, string> = {};
    productsSnap.docs.forEach((doc) => {
      const data = doc.data() as { vendorId?: string; commission_rate?: number; category?: unknown };
      if (data.vendorId) {
        productVendorMap[doc.id] = data.vendorId;
      }
    });

    // fetch all delivered orders
    const allOrdersSnap = await adminDB.collectionGroup("orders").get();

    interface PendingPayout {
      orderId: string;
      email: string;
      vendorId: string;
      storeName: string;
      amount: number;
      netAmount: number;
      commissionRate: number;
      deliveredAt: string;
      items: Array<{ title?: string; quantity?: number; price?: number; _id?: string }>;
    }

    const pendingPayouts: PendingPayout[] = [];

    for (const doc of allOrdersSnap.docs) {
      const data = doc.data() as {
        value?: {
          status?: string;
          payout_status?: string;
          amount?: number;
          delivered_at?: string;
          items?: Array<{ _id?: string; title?: string; quantity?: number; price?: number }>;
        };
      };

      const status = data.value?.status;
      const payoutStatus = data.value?.payout_status;

      // only include delivered orders with no...
      if (status !== "Delivered") continue;
      if (payoutStatus === "approved" || payoutStatus === "rejected") continue;

      const email = doc.ref.parent.parent?.id || "";
      const orderId = doc.id;
      const items = data.value?.items || [];
      const totalAmount = data.value?.amount || 0;

      // find the vendor for this order...
      let vendorId = "";
      for (const item of items) {
        const itemId = item._id || "";
        if (productVendorMap[itemId]) {
          vendorId = productVendorMap[itemId];
          break;
        }
      }

      if (!vendorId) continue;

      const vendor = vendorMap[vendorId] || {};
      
      // Calculate netAmount based on product categories
      let totalOrderCommission = 0;
      for (const item of items) {
        const itemId = item._id || "";
        const matchedProduct = productsSnap.docs
          .find((d) => d.id === itemId)
          ?.data() as any;
        const rate = getCommissionRate(matchedProduct);
        const itemSubtotal = (item.price || 0) * (item.quantity || 1);
        totalOrderCommission += itemSubtotal * rate;
      }
      
      // If totalOrderCommission is 0 (fallback), use vendor's default commission rate
      if (totalOrderCommission === 0 && totalAmount > 0) {
        const rate = vendor.commission_rate ?? 0.10;
        totalOrderCommission = totalAmount * rate;
      }
      
      const netAmount = totalAmount - totalOrderCommission;
      const effectiveCommissionRate = totalAmount > 0 ? totalOrderCommission / totalAmount : (vendor.commission_rate ?? 0.10);

      pendingPayouts.push({
        orderId,
        email,
        vendorId,
        storeName: vendor.store_name || vendorId,
        amount: totalAmount,
        netAmount: Math.round(netAmount * 100) / 100,
        commissionRate: effectiveCommissionRate,
        deliveredAt: data.value?.delivered_at || "",
        items,
      });
    }

    // sort by deliveredat descending
    pendingPayouts.sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));

    return NextResponse.json({ success: true, payouts: pendingPayouts });
  } catch (error) {
    console.error("[Admin Payouts GET] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// post — admin approves or rejects a payout
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    const { orderId, email, vendorId, action, netAmount } = await request.json();

    if (!orderId || !email || !vendorId || !["approve", "reject"].includes(action)) {
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

    if (action === "approve") {
      // mark payout as approved on the order
      await orderRef.update({ "value.payout_status": "approved" });

      // write payout record to vendor's payouts subcollection
      const payoutRef = adminDB
        .collection("vendors")
        .doc(vendorId)
        .collection("payouts")
        .doc(orderId);

      await payoutRef.set({
        orderId,
        amount: netAmount,
        approvedAt: new Date().toISOString(),
        approvedBy: session?.user?.email ?? "admin",
        email,
      });

      // publish realtime event so seller's dashboard updates immediately
      await publishRealtime({
        type: "payout:approved",
        data: { vendorId, orderId, amount: netAmount },
      });

      return NextResponse.json({ success: true, message: "Payout approved" });
    }

    if (action === "reject") {
      await orderRef.update({ "value.payout_status": "rejected" });

      await publishRealtime({
        type: "payout:rejected",
        data: { vendorId, orderId },
      });

      return NextResponse.json({ success: true, message: "Payout rejected" });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Admin Payouts POST] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
