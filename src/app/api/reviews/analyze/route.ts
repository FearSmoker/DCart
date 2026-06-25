import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const revalidate = 0;

// local js-based aspect sentiment fallback config
const ASPECTS_JS: Record<string, string[]> = {
  Battery: ["battery", "charge", "power", "charging", "life"],
  Display: ["display", "screen", "panel", "oled", "amoled", "viewing", "brightness"],
  Performance: ["performance", "speed", "fast", "smooth", "gaming", "lag", "processor", "chip"],
  Camera: ["camera", "photo", "video", "sensor", "lens", "pictures"],
  Heating: ["heating", "heat", "hot", "warm", "thermal"],
  Sound: ["sound", "audio", "speaker", "bass", "volume", "music"],
  Build: ["build", "quality", "material", "premium", "sturdy", "design", "look", "feel"],
  Price: ["price", "cost", "value", "expensive", "affordable", "cheap"],
  Software: ["software", "ui", "os", "android", "ios", "app", "bugs", "glitch", "crash"]
};

const POSITIVE_WORDS_JS = new Set(["great", "good", "excellent", "awesome", "perfect", "love", "amazing", "beautiful", "smooth", "fast", "premium", "stellar", "bright", "nice", "satisfied"]);
const NEGATIVE_WORDS_JS = new Set(["bad", "poor", "terrible", "heating", "heats", "hot", "slow", "lag", "laggy", "heavy", "expensive", "disappointed", "glitch", "bug", "crash", "heavier", "drains"]);
const NEGATIONS_JS = new Set(["not", "no", "never", "dont", "cant", "wont", "isnt", "wasnt", "arent", "havent"]);

interface ReviewObject {
  reviewId: string;
  email: string;
  rating: number;
  comment: string;
  timestamp: string;
}

function analyzeFallbackJS(reviews: ReviewObject[]) {
  let posReviews = 0;
  let negReviews = 0;
  const prosVotes: Record<string, number> = {};
  const consVotes: Record<string, number> = {};
  
  for (const key in ASPECTS_JS) {
    prosVotes[key] = 0;
    consVotes[key] = 0;
  }

  for (const rev of reviews) {
    const comment = (rev.comment || "").toLowerCase();
    const rating = Number(rev.rating || 3);

    const sentences = comment.split(/[.!?\n]+/);
    let revPos = 0;
    let revNeg = 0;

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      const words = sentence.match(/\b\w+\b/g) || [];
      let posCount = 0;
      let negCount = 0;
      let negated = false;

      for (const word of words) {
        if (NEGATIONS_JS.has(word)) {
          negated = true;
          continue;
        }

        let isPos = POSITIVE_WORDS_JS.has(word);
        let isNeg = NEGATIVE_WORDS_JS.has(word);

        if (negated) {
          [isPos, isNeg] = [isNeg, isPos];
          negated = false;
        }

        if (isPos) posCount++;
        if (isNeg) negCount++;
      }

      // map to aspect
      for (const aspect in ASPECTS_JS) {
        const keywords = ASPECTS_JS[aspect];
        const hasAspect = keywords.some((kw) => sentence.includes(kw));
        if (hasAspect) {
          if (posCount > negCount) prosVotes[aspect]++;
          else if (negCount > posCount) consVotes[aspect]++;
        }
      }

      if (posCount > negCount) revPos++;
      else if (negCount > posCount) revNeg++;
    }

    if (revPos > revNeg) posReviews++;
    else if (revNeg > revPos) negReviews++;
    else {
      if (rating >= 4) posReviews++;
      else if (rating <= 2) negReviews++;
    }
  }

  const pros: string[] = [];
  const cons: string[] = [];
  for (const key in ASPECTS_JS) {
    const p = prosVotes[key];
    const c = consVotes[key];
    if (p > c && p >= 1) pros.push(key);
    else if (c > p && c >= 1) cons.push(key);
  }

  const overallSentiment = posReviews > negReviews ? "Positive" : (negReviews > posReviews ? "Negative" : "Neutral");

  return {
    sentiment: overallSentiment,
    pros,
    cons
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ success: false, error: "Missing productId parameter" }, { status: 400 });
    }

    const reviewsKey = `dcart:product:${productId}:reviews`;

    // fetch only real user reviews (no fake seeding)
    let reviewsStrs: string[] = [];
    try {
      reviewsStrs = await redis.lrange(reviewsKey, 0, -1);
    } catch (err) {
      console.warn("[Reviews Analyze API] Redis lrange failed:", err);
    }

    const reviewsList: ReviewObject[] = [];
    for (const rStr of reviewsStrs) {
      try {
        const r = JSON.parse(rStr);
        // skip seeded/fake reviews
        if (r.email === "customer@example.com" || (r.reviewId && r.reviewId.startsWith("rev_seed_"))) {
          continue;
        }
        // only include in analyze list if...
        const isDetailedReview = (r.comment && r.comment.trim() !== "") || (r.title && r.title.trim() !== "");
        if (isDetailedReview) {
          reviewsList.push(r);
        }
      } catch {
        // ignore malformed
      }
    }

    if (reviewsList.length === 0) {
      return NextResponse.json({
        success: true,
        analysis: { sentiment: "No reviews yet", pros: [], cons: [] },
        fallback: true
      });
    }

    // contact python microservice for advanced nlp
    const pythonServiceUrl = process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";
    try {
      const res = await fetch(`${pythonServiceUrl}/reviews/analyze?product_id=${encodeURIComponent(productId)}`, {
        next: { revalidate: 0 }
      });
      const data = await res.json();
      return NextResponse.json({ success: true, analysis: data });
    } catch (err) {
      console.warn("[Reviews Analyze API] Python NLP service offline. Running local JS analysis fallback.", err);
      // run local js aspect analysis
      const analysis = analyzeFallbackJS(reviewsList);
      return NextResponse.json({ success: true, analysis, fallback: true });
    }
  } catch (error) {
    console.error("Reviews analysis endpoint error:", error);
    return NextResponse.json({ success: false, error: "Failed to analyze product reviews" }, { status: 500 });
  }
}
