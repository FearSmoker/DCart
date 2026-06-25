import { NextRequest, NextResponse } from "next/server";
import { getProductsData } from "@/lib/getData";
import { redis } from "@/lib/redis";
import { adminDB } from "@/firebaseAdmin";
import { ProductData } from "@/types";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const email = searchParams.get("email") || "";
    const productId = searchParams.get("productId") || "";

    const pythonServiceUrl = process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";

    const products = await getProductsData();

    // rule: if catalog contains <= 5...
    if (products.length <= 5) {
      if (type === "also-bought") {
        return NextResponse.json({
          success: true,
          products: products.filter((p) => p._id !== productId),
        });
      }
      return NextResponse.json({
        success: true,
        products: products,
      });
    }

    // otherwise, catalog contains >= 6 products:...
    if (type === "recommended") {
      let recommended: ProductData[] = [];
      const purchasedProductIds = new Set<string>();

      if (email) {
        try {
          const snapshot = await adminDB
            .collection("users")
            .doc(email)
            .collection("orders")
            .get();

          const purchasedCategoryNames = new Set<string>();

          snapshot.docs.forEach((doc) => {
            const orderVal = doc.data()?.value;
            const items = orderVal?.items || [];
            items.forEach((item: { _id?: string; id?: string; category?: unknown }) => {
              const itemId = item._id || item.id;
              if (itemId) purchasedProductIds.add(itemId);

              const category = item.category;
              if (Array.isArray(category)) {
                category.forEach((cat: unknown) => {
                  if (typeof cat === "string") {
                    purchasedCategoryNames.add(cat.toLowerCase());
                  } else if (cat && typeof cat === "object" && "name" in cat) {
                    purchasedCategoryNames.add(String((cat as { name: string }).name).toLowerCase());
                  }
                });
              } else if (typeof category === "string") {
                purchasedCategoryNames.add(category.toLowerCase());
              } else if (category && typeof category === "object" && "name" in category) {
                purchasedCategoryNames.add(String((category as { name: string }).name).toLowerCase());
              }
            });
          });

          if (purchasedCategoryNames.size > 0) {
            recommended = products.filter((p) => {
              if (purchasedProductIds.has(p._id)) return false;
              const productCategoryNames = (p.category || []).map((cat) =>
                String(cat?.name || "").toLowerCase()
              );
              return productCategoryNames.some((name) => purchasedCategoryNames.has(name));
            });
          }
        } catch (err) {
          console.warn("[Recommendations API] Failed to fetch order history for recommendation:", err);
        }
      }

      // fallback if no recommendation matched, or...
      if (recommended.length === 0) {
        recommended = products.filter((p) => !purchasedProductIds.has(p._id));
      }
      if (recommended.length === 0) {
        recommended = products;
      }

      return NextResponse.json({ success: true, products: recommended.slice(0, 4) });
    }

    if (type === "trending") {
      try {
        const redisKeys = products.map((p) => `dcart:analytics:product_views:${p._id}`);
        const views = await redis.mget(...redisKeys);
        const productsWithViews = products.map((p, idx) => {
          const viewCount = views[idx] ? parseInt(views[idx] as string, 10) : 0;
          return { product: p, views: viewCount };
        });

        // sort descending by unique views
        productsWithViews.sort((a, b) => b.views - a.views);
        const trendingProducts = productsWithViews.map((item) => item.product).slice(0, 4);

        return NextResponse.json({ success: true, products: trendingProducts });
      } catch (err) {
        console.warn("[Recommendations API] Redis views query failed, falling back to top rated:", err);
        const sorted = [...products].sort((a, b) => (b.ratings || 0) - (a.ratings || 0));
        return NextResponse.json({ success: true, products: sorted.slice(0, 4) });
      }
    }

    if (type === "also-bought") {
      try {
        const res = await fetch(`${pythonServiceUrl}/recommendations/customers-also-bought?product_id=${encodeURIComponent(productId)}`, {
          next: { revalidate: 0 }
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({ success: true, products: data });
        }
      } catch (err) {
        console.warn("[Recommendations API Gateway] Python service offline or failed. Falling back to category matching.", err);
      }

      // fallback: category matching
      const currentProduct = products.find((p) => p._id === productId);
      let fallback = products.filter((p) => p._id !== productId);
      if (currentProduct && currentProduct.category && currentProduct.category.length > 0) {
        const categoryIds = currentProduct.category.map((c) => c._id);
        const sameCategory = products.filter(
          (p) => p._id !== productId && p.category && p.category.some((c) => categoryIds.includes(c._id))
        );
        if (sameCategory.length > 0) {
          fallback = sameCategory;
        }
      }
      return NextResponse.json({ success: true, products: fallback.slice(0, 4) });
    }

    return NextResponse.json({ success: false, error: "Invalid recommendation type requested" }, { status: 400 });
  } catch (error) {
    console.error("Recommendations API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
