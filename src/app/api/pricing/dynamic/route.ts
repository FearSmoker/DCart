import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const revalidate = 0;

interface Product {
  _id: string;
  title: string;
  price: number;
  rowprice: number;
  quantity: number;
  category?: { _id: string; name: string }[];
}

function getDemandScore(productId: string, viewsMap: Record<string, number>): number {
  return viewsMap[productId] ?? 0;
}

function calculateDynamicPrice(
  basePrice: number,
  demandScore: number,
  stock: number,
  flashDiscount?: number
): { adjusted_price: number; rule: string; badge: string | null; badge_color: string | null; multiplier: number } {
  if (flashDiscount !== undefined) {
    const mult = 1 - flashDiscount / 100;
    return {
      adjusted_price: Math.round(basePrice * mult),
      rule: "flash_sale",
      badge: `Flash Sale -${Math.round(flashDiscount)}%`,
      badge_color: "purple",
      multiplier: mult,
    };
  }

  const HIGH_DEMAND = 50;
  const LOW_STOCK = 5;
  const HIGH_STOCK = 20;
  const LOW_DEMAND = 10;

  if (demandScore >= HIGH_DEMAND && stock <= LOW_STOCK) {
    const surgePct = Math.min(15, 5 + demandScore / 20);
    const mult = 1 + surgePct / 100;
    return {
      adjusted_price: Math.round(basePrice * mult),
      rule: "surge",
      badge: `High Demand +${Math.round(surgePct)}%`,
      badge_color: "red",
      multiplier: mult,
    };
  }
  if (demandScore >= HIGH_DEMAND) {
    return {
      adjusted_price: Math.round(basePrice * 1.07),
      rule: "demand_surge_mild",
      badge: "Popular +7%",
      badge_color: "orange",
      multiplier: 1.07,
    };
  }
  if (demandScore <= LOW_DEMAND && stock >= HIGH_STOCK) {
    return {
      adjusted_price: Math.round(basePrice * 0.9),
      rule: "clearance",
      badge: "Clearance -10%",
      badge_color: "green",
      multiplier: 0.9,
    };
  }
  return {
    adjusted_price: basePrice,
    rule: "base",
    badge: null,
    badge_color: null,
    multiplier: 1.0,
  };
}

export async function GET(req: NextRequest) {
  const pythonUrl = process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("product_id");

  try {
    const endpoint = productId
      ? `${pythonUrl}/pricing/dynamic`
      : `${pythonUrl}/pricing/catalog`;

    const fetchRes = await fetch(
      productId ? endpoint : `${endpoint}?limit=50`,
      productId
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          }
        : { method: "GET" }
    );
    if (fetchRes.ok) {
      const data = await fetchRes.json();
      return NextResponse.json(data);
    }
  } catch { /* fall through to local fallback */ }

  // local fallback: compute dynamic prices from Redis
  try {
    const productsStr = await redis.get("dcart:products");
    const allProducts: Product[] = productsStr ? JSON.parse(productsStr) : [];

    // demand scores from analytics cache
    let viewsMap: Record<string, number> = {};
    try {
      const topProductsStr = await redis.get("dcart:analytics:top_products_cache");
      if (topProductsStr) viewsMap = JSON.parse(topProductsStr);
    } catch { /* no analytics */ }

    const productsToPrice = productId
      ? allProducts.filter((p) => p._id === productId)
      : allProducts;

    const result = await Promise.all(
      productsToPrice.map(async (p) => {
        const stockStr = await redis.get(`dcart:stock:${p._id}`).catch(() => null);
        const stock = stockStr ? parseInt(stockStr) : (p.quantity ?? 10);
        const demand = getDemandScore(p._id, viewsMap);

        let flashDiscount: number | undefined;
        try {
          const flashStr = await redis.get(`dcart:pricing:flash_sale:${p._id}`);
          if (flashStr) {
            const flashData = JSON.parse(flashStr);
            flashDiscount = flashData.discount_pct;
          }
        } catch { /* no flash */ }

        const pricing = calculateDynamicPrice(p.price, demand, stock, flashDiscount);
        return {
          ...p,
          dynamic_price: pricing.adjusted_price,
          price_rule: pricing.rule,
          price_badge: pricing.badge,
          badge_color: pricing.badge_color,
          price_multiplier: pricing.multiplier,
          demand_score: demand,
          current_stock: stock,
        };
      })
    );

    if (productId) {
      const p = result[0];
      return NextResponse.json({
        success: true,
        product_id: productId,
        base_price: p?.price,
        ...(p ? {
          adjusted_price: p.dynamic_price,
          rule: p.price_rule,
          badge: p.price_badge,
          badge_color: p.badge_color,
          multiplier: p.price_multiplier,
        } : {}),
        mode: "local_js",
      });
    }

    return NextResponse.json({ success: true, products: result, total: result.length, mode: "local_js" });
  } catch (err) {
    console.error("Pricing API error:", err);
    return NextResponse.json({ success: false, error: "Pricing service unavailable" }, { status: 503 });
  }
}

// POST: trigger flash sale (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const isAdmin =
      session?.user?.email === process.env.ADMIN_EMAIL ||
      session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }
    const body = await request.json();
    const { product_ids, discount_pct = 20, duration_minutes = 60 } = body as {
      product_ids: string[];
      discount_pct?: number;
      duration_minutes?: number;
    };

    const pythonUrl = process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";
    try {
      const res = await fetch(`${pythonUrl}/pricing/flash-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids, discount_pct, duration_minutes }),
      });
      if (res.ok) return NextResponse.json(await res.json());
    } catch { /* fallback */ }

    // local Redis flash sale fallback
    const expiresAt = new Date(Date.now() + duration_minutes * 60000).toISOString();
    for (const pid of product_ids) {
      await redis.setex(
        `dcart:pricing:flash_sale:${pid}`,
        duration_minutes * 60,
        JSON.stringify({ discount_pct, expires_at: expiresAt, duration_minutes })
      );
    }
    return NextResponse.json({
      success: true,
      triggered: product_ids,
      discount_pct,
      expires_at: expiresAt,
      message: `Flash sale active for ${duration_minutes} minutes`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}