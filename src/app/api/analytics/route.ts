import { NextResponse } from "next/server";
import { getProductsData } from "@/lib/getData";
import { getSession } from "@/lib/manageSession";
import { adminDB } from "@/firebaseAdmin";
import { redis } from "@/lib/redis";

export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access Denied" },
        { status: 403 }
      );
    }

    const products = await getProductsData();

    const snapshot = await adminDB.collectionGroup("orders").get();
    const ordersList = snapshot.docs.map((doc) => {
      const email = doc.ref.parent.parent?.id || "";
      return {
        id: doc.id,
        email,
        ...(doc.data() as Record<string, unknown>),
      } as {
        email: string; id: string; timestamp?: string;
        value?: { amount: number; timestamp?: string; status?: string;
          items?: Array<{ _id?: string; id?: string; quantity?: number; title?: string }>;
        };
      };
    });

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

    let totalRevenue = 0;
    let totalProfit = 0;
    const activeUsersSet = new Set<string>();
    const productSalesCount: Record<string, number> = {};
    const categorySalesCount: Record<string, number> = {};

    ordersList.forEach((order) => {
      const status = (order.value?.status || "").toLowerCase();
      const isInactive = ["cancelled", "cancelled as fraud", "flagged fraud", "returned"].includes(status);
      const amount = order.value?.amount || 0;
      
      if (!isInactive) {
        totalRevenue += amount;
        if (order.email) activeUsersSet.add(order.email);
      }

      const items = order.value?.items || [];
      items.forEach((item) => {
        const itemId = item._id || item.id;
        const matchedProduct = products.find((p) => p._id === itemId);
        const quantity = item.quantity || 1;
        
        if (itemId && !isInactive) {
          productSalesCount[itemId] = (productSalesCount[itemId] || 0) + quantity;
        }

        const itemPrice = matchedProduct?.price || (items.length > 0 ? (amount / items.length) : 0);
        const itemSubtotal = itemPrice * quantity;
        
        const rate = getCommissionRate(matchedProduct);
        const itemProfit = itemSubtotal * rate;
        
        if (!isInactive) {
          totalProfit += itemProfit;
        }
      });
    });

    // top 5 products by sales
    const sortedProductIds = Object.keys(productSalesCount)
      .sort((a, b) => productSalesCount[b] - productSalesCount[a])
      .slice(0, 5);

    const topProducts: Array<Record<string, unknown>> = [];
    sortedProductIds.forEach((id) => {
      const matched = products.find((p) => p._id === id);
      if (matched) {
        topProducts.push({ id, title: matched.title, brand: matched.brand, price: matched.price, image: matched.image, salesCount: productSalesCount[id] });
        if (matched.category) {
          const categoryList = Array.isArray(matched.category) ? matched.category : [matched.category];
          categoryList.forEach((cat: any) => {
            const catName = typeof cat === "string" ? cat : cat.name;
            if (catName) {
              categorySalesCount[catName] = (categorySalesCount[catName] || 0) + productSalesCount[id];
            }
          });
        }
      }
    });

    const topCategories = Object.keys(categorySalesCount)
      .sort((a, b) => categorySalesCount[b] - categorySalesCount[a])
      .slice(0, 5)
      .map((name) => ({ name, salesCount: categorySalesCount[name] }));

    const totalOrders = ordersList.filter(o => {
      const status = (o.value?.status || "").toLowerCase();
      return !["cancelled", "cancelled as fraud", "flagged fraud", "returned"].includes(status);
    }).length;

    let totalViews = 0;
    try {
      const viewsStr = await redis.get("dcart:analytics:total_views");
      totalViews = viewsStr ? parseInt(viewsStr, 10) : 0;
    } catch {
      totalViews = totalOrders * 5; // fallback estimate
    }

    let uniqueConsumerVisitors = 0;
    try {
      uniqueConsumerVisitors = await redis.scard("dcart:analytics:unique_consumers_set");
    } catch (err) {
      console.warn("Failed to get unique consumers count:", err);
    }
    
    // floor at active order-placing users
    uniqueConsumerVisitors = Math.max(uniqueConsumerVisitors, activeUsersSet.size);

    const conversionRate = uniqueConsumerVisitors > 0 ? (totalOrders / uniqueConsumerVisitors) * 100 : 0;
    const activeUsersCount = activeUsersSet.size;

    // last 7 days chart
    const chartData = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const dayOrders = ordersList.filter((order) => {
        const ts = order.timestamp || order.value?.timestamp;
        if (ts) return ts.startsWith(dateStr);
        return false;
      });

      const dayRevenue = dayOrders
        .filter((o) => {
          const status = (o.value?.status || "").toLowerCase();
          return !["cancelled", "cancelled as fraud", "flagged fraud", "returned"].includes(status);
        })
        .reduce((sum, order) => sum + (order.value?.amount || 0), 0);

      const dayCancelledRevenue = dayOrders
        .filter((o) => {
          const status = (o.value?.status || "").toLowerCase();
          return ["cancelled", "cancelled as fraud", "flagged fraud", "returned"].includes(status);
        })
        .reduce((sum, order) => sum + (order.value?.amount || 0), 0);

      const dayCancelledOrdersCount = dayOrders
        .filter((o) => {
          const status = (o.value?.status || "").toLowerCase();
          return ["cancelled", "cancelled as fraud", "flagged fraud", "returned"].includes(status);
        })
        .length;

      const activeDayOrdersCount = dayOrders
        .filter((o) => {
          const status = (o.value?.status || "").toLowerCase();
          return !["cancelled", "cancelled as fraud", "flagged fraud", "returned"].includes(status);
        })
        .length;

      // augment today with Redis daily_sales hash
      let redisRevenue = 0;
      let redisOrders = 0;
      if (i === 0) {
        try {
          const dailyKey = `dcart:analytics:daily_sales:${dateStr}`;
          const [ordersVal, revenueVal] = await Promise.all([
            redis.hget(dailyKey, "orders"),
            redis.hget(dailyKey, "revenue"),
          ]);
          redisOrders = ordersVal ? parseInt(ordersVal) : 0;
          redisRevenue = revenueVal ? parseFloat(revenueVal) : 0;
        } catch { /* ignore */ }
      }

      chartData.push({
        date: dateStr.substring(5), // MM-DD
        revenue: Math.max(dayRevenue, redisRevenue),
        orders: Math.max(activeDayOrdersCount, redisOrders),
        cancelled: dayCancelledRevenue,
        cancelledOrdersCount: dayCancelledOrdersCount,
      });
    }

    const avgCommissionRate = totalRevenue > 0 ? (totalProfit / totalRevenue) : 0.10;

    // cache top products in Redis, 1h TTL
    try {
      const topProductsViewMap: Record<string, number> = {};
      for (const id of Object.keys(productSalesCount)) {
        topProductsViewMap[id] = productSalesCount[id];
      }
      await redis.set("dcart:analytics:top_products_cache", JSON.stringify(topProductsViewMap), "EX", 3600);
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      data: {
        cards: {
          totalRevenue,
          totalOrders,
          totalViews,
          uniqueConsumerVisitors,
          activeUsers: activeUsersCount,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          platformCommission: totalProfit,
          platformProfit: totalProfit,
          commissionRate: avgCommissionRate,
        },
        chartData,
        topProducts,
        topCategories,
      },
    });
  } catch (error) {
    console.error("Analytics fetch API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load analytics metrics data" },
      { status: 500 }
    );
  }
}