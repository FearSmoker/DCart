import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";

export const revalidate = 0;

interface Product {
  _id: string;
  title: string;
  brand: string;
  price: number;
  rowprice: number;
  ratings: number;
  category: { _id: string; name: string }[];
  description: string;
  slug: { current: string; _type: string } | string;
}

// ─── local comparison agent (fallback when...
function generateLocalComparison(products: Product[]) {
  if (products.length < 2) {
    return {
      headline: "Select at least 2 products to compare",
      features_table: [],
      pros_cons: {},
      recommendation: "Please select at least 2 products.",
      recommended_id: products[0]?._id ?? null,
    };
  }

  const featureTable = [
    {
      feature: "Price",
      values: Object.fromEntries(
        products.map((p) => [p.title, `₹${p.price.toLocaleString("en-IN")}`])
      ),
    },
    {
      feature: "Brand",
      values: Object.fromEntries(products.map((p) => [p.title, p.brand])),
    },
    {
      feature: "Rating",
      values: Object.fromEntries(
        products.map((p) => [p.title, `${p.ratings}/5 ★`])
      ),
    },
    {
      feature: "Original Price",
      values: Object.fromEntries(
        products.map((p) => [
          p.title,
          `₹${p.rowprice.toLocaleString("en-IN")}`,
        ])
      ),
    },
    {
      feature: "Savings",
      values: Object.fromEntries(
        products.map((p) => [
          p.title,
          `₹${(p.rowprice - p.price).toLocaleString("en-IN")}`,
        ])
      ),
    },
    {
      feature: "Category",
      values: Object.fromEntries(
        products.map((p) => [
          p.title,
          p.category?.map((c) => c.name).join(", ") || "N/A",
        ])
      ),
    },
  ];

  const cheapest = products.reduce((a, b) => (a.price < b.price ? a : b));
  const topRated = products.reduce((a, b) =>
    a.ratings > b.ratings ? a : b
  );
  const bestDeal = products.reduce((a, b) =>
    a.rowprice - a.price > b.rowprice - b.price ? a : b
  );

  const prosCons: Record<
    string,
    { pros: string[]; cons: string[] }
  > = {};
  for (const p of products) {
    const pros: string[] = [];
    const cons: string[] = [];
    if (p === cheapest) pros.push("Best price");
    else cons.push("Higher price than alternatives");
    if (p === topRated) pros.push("Highest customer rating");
    if (p === bestDeal) pros.push("Best discount / savings");
    if (p.ratings < 4.0) cons.push("Lower than average rating");
    prosCons[p.title] = {
      pros: pros.length ? pros : ["Solid choice"],
      cons: cons.length ? cons : ["Compare more features"],
    };
  }

  const recommended = topRated;
  return {
    headline: `Comparing ${products.length} products — Agent Analysis`,
    features_table: featureTable,
    pros_cons: prosCons,
    recommendation: `We recommend the **${recommended.title}** (${recommended.ratings}/5 ★, ₹${recommended.price.toLocaleString("en-IN")}) based on the highest customer rating and overall value.`,
    recommended_id: recommended._id,
  };
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateKey = `ratelimit:compare:${ip}`;

  try {
    const { success, remaining } = await rateLimit(rateKey, 20, 60); // 20 requests per minute
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Too Many Requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }
  } catch (err) {
    console.error("Rate limiting error on compare:", err);
  }

  try {
    const body = await request.json();
    const { product_ids, query } = body as {
      product_ids: string[];
      query?: string;
    };

    if (!product_ids || product_ids.length < 2) {
      return NextResponse.json(
        { success: false, error: "Please provide at least 2 product IDs." },
        { status: 400 }
      );
    }

    const pythonServiceUrl =
      process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";

    try {
      const res = await fetch(`${pythonServiceUrl}/agent/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids, query }),
        next: { revalidate: 0 },
      });

      if (!res.ok) throw new Error(`Python service ${res.status}`);

      const data = await res.json();
      return NextResponse.json(data);
    } catch (err) {
      console.warn(
        "[Compare Agent API] Python service offline, using local fallback.",
        err
      );

      // local fallback: fetch products from redis cache
      try {
        const productsStr = await redis.get("dcart:products");
        if (productsStr) {
          const allProducts = JSON.parse(productsStr) as Product[];
          const products = allProducts.filter((p) =>
            product_ids.includes(p._id)
          );
          const comparison = generateLocalComparison(products);
          return NextResponse.json({
            success: true,
            comparison,
            products,
            mode: "local_js_agent",
            tools_used: ["fetch_products_redis", "local_comparison_agent"],
          });
        }
      } catch (redisErr) {
        console.warn(
          "[Compare Agent API] Redis unavailable too:",
          redisErr
        );
      }

      return NextResponse.json({
        success: false,
        error: "Comparison service temporarily unavailable.",
      });
    }
  } catch (error) {
    console.error("Compare agent API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process comparison request" },
      { status: 500 }
    );
  }
}
