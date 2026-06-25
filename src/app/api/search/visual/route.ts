import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";
import { askGeminiVision } from "@/lib/gemini";
import { searchProducts } from "@/lib/searchService";

export const revalidate = 0;

// lightweight lexical fallback — no python service or gemini available
function keywordFallback(products: Record<string, unknown>[], limit: number) {
  return products.slice(0, limit);
}

// Merge and rank products from CLIP and Gemini
function mergeResults(clipProducts: any[], geminiProducts: any[]): any[] {
  const mergedMap = new Map<string, { product: any; score: number }>();

  // CLIP visual matching results
  clipProducts.forEach((p, index) => {
    const id = p._id || p.id;
    if (id) {
      mergedMap.set(id, { product: p, score: (clipProducts.length - index) * 1.5 });
    }
  });

  // Gemini keyword semantic matching results
  geminiProducts.forEach((p, index) => {
    const id = p._id || p.id;
    if (id) {
      const existing = mergedMap.get(id);
      const scoreToAdd = geminiProducts.length - index;
      if (existing) {
        existing.score += scoreToAdd * 2.0; // Significant boost if matched by both systems
      } else {
        mergedMap.set(id, { product: p, score: scoreToAdd });
      }
    }
  });

  // Sort by combined score descending
  return Array.from(mergedMap.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateKey = `ratelimit:visualsearch:${ip}`;

  try {
    const { success, remaining } = await rateLimit(rateKey, 10, 60); // 10 requests per minute
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Too Many Requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }
  } catch (err) {
    console.error("Rate limiting error on visualsearch:", err);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Missing image file" },
        { status: 400 }
      );
    }

    const limitParam = request.nextUrl.searchParams.get("limit") || "6";
    const limit = parseInt(limitParam, 10);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const fileName = file.name || "upload.jpg";

    let clipResults: any[] = [];
    let geminiResults: any[] = [];
    let isClipSuccess = false;
    let isGeminiSuccess = false;

    // 1. Trigger CLIP-based Python service visual search (parallelizable promise)
    const runClipSearch = async () => {
      const pythonServiceUrl = process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";
      const pythonFormData = new FormData();
      pythonFormData.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);

      try {
        const res = await fetch(`${pythonServiceUrl}/search/visual?limit=${limit}`, {
          method: "POST",
          body: pythonFormData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.results)) {
            clipResults = data.results;
            isClipSuccess = true;
          }
        }
      } catch (err) {
        console.warn("[Visual Search API] Python CLIP service unavailable:", err);
      }
    };

    // 2. Trigger Gemini Vision-based semantic search (parallelizable promise)
    const runGeminiSearch = async () => {
      try {
        const promptText = `Analyze this product image. Identify the brand, main category, color, features, and style.
Return a search query of 3 to 6 keywords (space-separated, e.g. "red Nike running shoes" or "black ASUS gaming laptop") that will be most effective for finding this exact or very similar product in an online catalog.
Output ONLY the raw space-separated keywords and absolutely nothing else. No explanation, no punctuation, no markdown.`;

        const keywords = await askGeminiVision(fileBuffer, mimeType, promptText);
        if (keywords && keywords.trim()) {
          console.log(`[Visual Search API] Gemini generated keywords: "${keywords.trim()}"`);
          const matched = await searchProducts(keywords.trim());
          if (Array.isArray(matched)) {
            geminiResults = matched.slice(0, limit);
            isGeminiSuccess = true;
          }
        }
      } catch (err) {
        console.warn("[Visual Search API] Gemini Vision service failed:", err);
      }
    };

    // Run both searches concurrently
    await Promise.all([runClipSearch(), runGeminiSearch()]);

    // Handle hybrid/fallback logic
    if (isClipSuccess && isGeminiSuccess) {
      const merged = mergeResults(clipResults, geminiResults).slice(0, limit);
      return NextResponse.json({
        success: true,
        results: merged,
        mode: "hybrid_clip_gemini",
        count: merged.length,
      });
    } else if (isClipSuccess) {
      return NextResponse.json({
        success: true,
        results: clipResults,
        mode: "clip_faiss",
        count: clipResults.length,
      });
    } else if (isGeminiSuccess) {
      return NextResponse.json({
        success: true,
        results: geminiResults,
        mode: "gemini_vision",
        count: geminiResults.length,
      });
    }

    // Both models failed — use fallback to popular products in Redis
    console.warn("[Visual Search API] Both CLIP and Gemini failed, falling back to cache.");
    try {
      const productsStr = await redis.get("dcart:products");
      if (productsStr) {
        const products = JSON.parse(productsStr) as Record<string, unknown>[];
        const results = keywordFallback(products, limit);
        return NextResponse.json({
          success: true,
          results,
          mode: "cache_fallback",
          count: results.length,
          message: "AI visual search is temporarily offline. Showing popular products.",
        });
      }
    } catch (redisErr) {
      console.warn("[Visual Search API] Redis also unavailable:", redisErr);
    }

    return NextResponse.json({
      success: true,
      results: [],
      mode: "empty_fallback",
      count: 0,
      message: "Visual search service is temporarily unavailable.",
    });

  } catch (error) {
    console.error("Visual search API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process visual search request" },
      { status: 500 }
    );
  }
}
