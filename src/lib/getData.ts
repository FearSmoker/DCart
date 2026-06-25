import { client } from "@/sanity/lib/client";
import { bannerQuery, bestSellersQuery, productsQuery } from "./queries";
import { projectId } from "@/sanity/env";
import { redis } from "./redis";
import { ProductData } from "../../types";

export const revalidate = 0;

// Cache the Sanity availability check to avoid hammering the API on every request
async function isSanityAvailable(): Promise<boolean> {
  if (!projectId || projectId === "placeholder") return false;
  const flagKey = "dcart:sanity_unavailable";
  try {
    const flag = await redis.get(flagKey);
    if (flag === "1") return false; // cached: dataset is unavailable
  } catch { /* redis not available, try Sanity anyway */ }
  return true;
}

async function markSanityUnavailable() {
  try {
    // Cache for 60 minutes so we don't retry on every page load
    await redis.setex("dcart:sanity_unavailable", 3600, "1");
  } catch { /* ignore */ }
}

async function syncStockWithRedis(products: ProductData[]): Promise<ProductData[]> {
  try {
    const pipeline = redis.pipeline();
    products.forEach((product) => {
      const stockKey = `dcart:stock:${product._id}`;
      pipeline.get(stockKey);
    });
    const results = await pipeline.exec();

    const updatedProducts = await Promise.all(
      products.map(async (product, index) => {
        const stockKey = `dcart:stock:${product._id}`;
        const redisStockResult = results ? results[index][1] : null;

        let stock = product.quantity;
        if (redisStockResult !== null && redisStockResult !== undefined) {
          stock = Number(redisStockResult);
        } else {
          const initialStock = product.quantity || 0;
          await redis.set(stockKey, String(initialStock));
          stock = initialStock;
        }

        return {
          ...product,
          quantity: stock,
        };
      })
    );
    return updatedProducts;
  } catch (error) {
    console.warn("Error syncing stock with Redis:", error);
    return products;
  }
}

const getBannersData = async () => {
  if (!(await isSanityAvailable())) return [];
  const cacheKey = "dcart:banners";
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* redis miss, fetch from Sanity */ }

  try {
    const bannersData = await client.fetch(bannerQuery);
    if (bannersData && bannersData.length > 0) {
      try { await redis.setex(cacheKey, 3600, JSON.stringify(bannersData)); } catch { /* ignore */ }
    }
    return bannersData || [];
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 404) {
      console.warn("[Sanity] Dataset 'production' not found. Create it at sanity.io/manage → Datasets.");
      await markSanityUnavailable();
    } else {
      console.warn("[Sanity] Could not fetch banners:", (error as Error)?.message ?? error);
    }
    return [];
  }
};

// Fetch all real seller-listed products from Firestore
async function getFirestoreProducts(): Promise<ProductData[]> {
  let sellerProducts: ProductData[] = [];
  try {
    const { adminDB } = await import("@/firebaseAdmin");
    const snapshot = await adminDB.collection("products").get();
    sellerProducts = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        _id: doc.id,
        _type: "product",
        _createdAt: d.createdAt || new Date().toISOString(),
        _updatedAt: d.updatedAt || new Date().toISOString(),
        title: d.title,
        brand: d.brand || "DCart Seller",
        price: Number(d.price),
        rowprice: Number(d.rowprice || d.price * 1.2),
        ratings: Number(d.ratings || 5),
        description: d.description,
        slug: { current: d.slug, _type: "slug" },
        image: d.image || (d.variants && d.variants[0]?.images[0]) || "",
        category: [{ _id: `cat_${d.category}`, name: d.category }],
        quantity: Number(d.quantity || 0),
        variants: d.variants || [],
        customFields: d.customFields || {},
        material: d.material || null,
        modelInfo: d.modelInfo || null,
        vendorId: d.vendorId,
      } as unknown as ProductData;
    });
  } catch (err) {
    console.warn("Failed to fetch seller products from Firestore:", err);
  }
  return sellerProducts;
}

async function injectLiveRatings(products: ProductData[]): Promise<ProductData[]> {
  try {
    const updated = await Promise.all(
      products.map(async (product) => {
        const cachedRating = await redis.get(`dcart:product:${product._id}:rating`);
        if (cachedRating) {
          return {
            ...product,
            ratings: Number(cachedRating),
          };
        }
        return product;
      })
    );
    return updated;
  } catch (error) {
    console.warn("Error injecting live ratings:", error);
    return products;
  }
}

const getProductsData = async () => {
  const cacheKey = "dcart:products";
  let baseProducts: ProductData[] = [];

  const sanityActive = await isSanityAvailable();
  if (sanityActive) {
    let cacheHit = false;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        baseProducts = JSON.parse(cached);
        cacheHit = true;
      }
    } catch { /* redis miss */ }

    if (!cacheHit) {
      try {
        const productsData = await client.fetch(productsQuery);
        if (productsData !== null && productsData !== undefined) {
          try { await redis.setex(cacheKey, 3600, JSON.stringify(productsData)); } catch { /* ignore */ }
          baseProducts = productsData;
        }
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404) {
          console.warn("[Sanity] Dataset 'production' not found. Showing Firestore seller products only.");
          await markSanityUnavailable();
        } else {
          console.warn("[Sanity] Could not fetch products:", (error as Error)?.message ?? error);
        }
      }
    }
  }

  // Always merge with real Firestore seller products
  const sellerProducts = await getFirestoreProducts();
  const combined = [...baseProducts, ...sellerProducts];
  const withRatings = await injectLiveRatings(combined);
  return syncStockWithRedis(withRatings);
};

const getBestSellersData = async () => {
  const sanityActive = await isSanityAvailable();

  if (sanityActive) {
    const cacheKey = "dcart:bestsellers";
    let bestSellers: ProductData[] = [];
    try {
      const cached = await redis.get(cacheKey);
      if (cached) bestSellers = JSON.parse(cached);
    } catch { /* redis miss */ }

    if (bestSellers.length === 0) {
      try {
        const bestSellersData = await client.fetch(bestSellersQuery);
        if (bestSellersData && bestSellersData.length > 0) {
          try { await redis.setex(cacheKey, 3600, JSON.stringify(bestSellersData)); } catch { /* ignore */ }
          bestSellers = bestSellersData;
        }
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode !== 404) {
          console.warn("[Sanity] Could not fetch best sellers:", (error as Error)?.message ?? error);
        }
      }
    }

    if (bestSellers.length > 0) {
      const withRatings = await injectLiveRatings(bestSellers);
      return syncStockWithRedis(withRatings);
    }
  }

  // Fallback: use top Firestore seller products (first 4)
  const firestoreProducts = await getFirestoreProducts();
  const withRatings = await injectLiveRatings(firestoreProducts.slice(0, 4));
  return syncStockWithRedis(withRatings);
};

export { getBannersData, getProductsData, getBestSellersData };