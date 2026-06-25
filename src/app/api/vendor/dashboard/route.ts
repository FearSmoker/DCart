import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { auth } from "@/auth";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendor_id");

  if (!vendorId) {
    return NextResponse.json({ success: false, error: "vendor_id required" }, { status: 400 });
  }

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { role, vendorId: userVendorId } = session.user as { role?: string; vendorId?: string };
    if (role !== "admin" && (role !== "seller" || userVendorId !== vendorId)) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }
    const vendorDoc = await adminDB.collection("vendors").doc(vendorId).get();
    const profile = vendorDoc.exists
      ? vendorDoc.data()
      : { store_name: "DCart Vendor Store", approved: true };

    // root products collection (not subcollection)
    let products: Array<Record<string, unknown>> = [];
    let vendorProductIds = new Set<string>();
    try {
      const productsSnap = await adminDB
        .collection("products")
        .where("vendorId", "==", vendorId)
        .get();
      products = productsSnap.docs.map((d) => ({
        id: d.id,
        _id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
      vendorProductIds = new Set(productsSnap.docs.map((d) => d.id));
    } catch (err) {
      console.warn("[Vendor Dashboard] Failed to fetch vendor products:", err);
    }

    // scan all orders, filter to this vendor's products
    const snapshot = await adminDB.collectionGroup("orders").get();
    const allOrders = snapshot.docs.map((doc) => ({
      ...(doc.data() as Record<string, unknown>),
    })) as Array<{
      timestamp?: string;
      value?: {
        amount: number;
        timestamp?: string;
        items?: Array<{ _id?: string; id?: string; quantity?: number; title?: string; price?: number }>;
      };
    }>;

    let totalRevenue = 0;
    let totalOrders = 0;
    let confirmedRevenue = 0; // delivered orders only
    let cancelledRevenue = 0; // cancelled/returned orders

    // rolling 6-month labels ending at current month
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const labels: string[] = [];
    const monthIndices: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      labels.push(`${monthNames[monthIdx]} ${year}`);
      monthIndices.push(monthIdx);
    }

    const monthlyRevenue = new Array(6).fill(0);
    const monthlyOrders = new Array(6).fill(0);
    const monthlyCancelled = new Array(6).fill(0);

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

    let totalCommission = 0;
    let confirmedCommission = 0;

    allOrders.forEach((order) => {
      const items = (order as Record<string, unknown> & { value?: { items?: Array<{ _id?: string; id?: string; quantity?: number; price?: number }> } }).value?.items || [];
      const orderStatus = ((order as Record<string, unknown> & { value?: { status?: string } }).value?.status || "").toLowerCase();

      const vendorItems = items.filter((item) => {
        const itemId = item._id || item.id || "";
        return vendorProductIds.has(itemId);
      });

      if (vendorItems.length === 0) return;

      let orderRevenue = 0;
      let orderCommission = 0;
      let orderConfirmedRevenue = 0;

      vendorItems.forEach((item) => {
        const itemId = item._id || item.id || "";
        const matchedProduct = products.find((p) => p._id === itemId || p.id === itemId);
        const rate = getCommissionRate(matchedProduct);
        const itemSubtotal = (item.price || 0) * (item.quantity || 1);
        const itemCommission = itemSubtotal * rate;

        orderRevenue += itemSubtotal;
        orderCommission += itemCommission;

        if (orderStatus === "delivered") {
          orderConfirmedRevenue += itemSubtotal;
        }
      });

      const isInactive = ["cancelled", "cancelled as fraud", "flagged fraud", "returned"].includes(orderStatus);

      if (!isInactive) {
        totalRevenue += orderRevenue;
        totalCommission += orderCommission;
        totalOrders += 1;
      }

      if (orderStatus === "delivered") {
        confirmedRevenue += orderConfirmedRevenue;
        confirmedCommission += orderCommission;
      }

      if (isInactive) {
        cancelledRevenue += orderRevenue;
      }

      const ts = (order as Record<string, unknown> & { timestamp?: string; value?: { timestamp?: string } }).timestamp || (order as Record<string, unknown> & { value?: { timestamp?: string } }).value?.timestamp;
      if (ts) {
        const orderDate = new Date(ts);
        const orderMonth = orderDate.getMonth();
        const orderYear = orderDate.getFullYear();

        for (let i = 0; i < 6; i++) {
          const labelMonth = monthIndices[i];
          const labelYear =
            labelMonth > currentMonth ? currentYear - 1 : currentYear;
          if (orderMonth === labelMonth && orderYear === labelYear) {
            if (isInactive) {
              monthlyCancelled[i] += orderRevenue;
            } else {
              monthlyRevenue[i] += orderRevenue;
              monthlyOrders[i] += 1;
            }
            break;
          }
        }
      }
    });

    const avgCommissionRate = totalRevenue > 0 ? (totalCommission / totalRevenue) : 0.10;
    const vendorEarnings = totalRevenue - totalCommission; // net of commission, all orders
    const confirmedEarnings = confirmedRevenue - confirmedCommission; // net of commission, delivered only

    let totalPaidOut = 0;
    try {
      const payoutsSnap = await adminDB
        .collection("vendors")
        .doc(vendorId)
        .collection("payouts")
        .get();
      payoutsSnap.docs.forEach((doc) => {
        totalPaidOut += Number(doc.data().amount || 0);
      });
    } catch { /* no payouts yet */ }

    const pendingPayout = Math.max(0, confirmedEarnings - totalPaidOut);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return NextResponse.json({
      success: true,
      vendor_id: vendorId,
      profile,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      platform_commission: totalCommission,
      vendor_earnings: vendorEarnings,
      confirmed_earnings: confirmedEarnings,
      pending_payout: pendingPayout,
      total_paid_out: totalPaidOut,
      commission_rate: avgCommissionRate,
      avg_order_value: avgOrderValue,
      cancelled_revenue: cancelledRevenue,
      products,
      product_count: products.length,
      monthly_chart: {
        labels,
        revenue: monthlyRevenue,
        orders: monthlyOrders,
        cancelled: monthlyCancelled,
      },
    });
  } catch (error) {
    console.error("Vendor dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}