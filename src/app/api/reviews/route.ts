import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";


export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ success: false, error: "Missing productId" }, { status: 400 });
    }

    const reviewsKey = `dcart:product:${productId}:reviews`;

    let reviewsStrs: string[] = [];
    try {
      reviewsStrs = await redis.lrange(reviewsKey, 0, -1);
    } catch (err) {
      console.warn("[Reviews API] Redis lrange failed:", err);
    }

    // dedupe emails before firestore lookups
    const uniqueEmails = Array.from(
      new Set(
        reviewsStrs
          .map((rStr) => {
            try {
              return JSON.parse(rStr).email;
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      )
    );

    const verifiedMap: Record<string, boolean> = {};
    try {
      const { adminDB } = await import("@/firebaseAdmin");
      await Promise.all(
        uniqueEmails.map(async (email) => {
          try {
            const ordersSnapshot = await adminDB
              .collection("users")
              .doc(email!)
              .collection("orders")
              .get();
            let hasPurchased = false;
            for (const doc of ordersSnapshot.docs) {
              const data = doc.data();
              const items = data?.value?.items || [];
              if (items.some((item: { _id?: string; id?: string }) => (item._id || item.id) === productId)) {
                hasPurchased = true;
                break;
              }
            }
            verifiedMap[email!] = hasPurchased;
          } catch (err) {
            console.warn(`[Reviews API] Failed to verify purchase for ${email}:`, err);
            verifiedMap[email!] = false;
          }
        })
      );
    } catch (importErr) {
      console.warn("[Reviews API] firebaseAdmin import failed:", importErr);
    }

    const reviews = [];
    let sum = 0;
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let foundSeeded = false;
    const cleanedList: string[] = [];
    let totalRatings = 0;

    for (const rStr of reviewsStrs) {
      try {
        const r = JSON.parse(rStr);
        if (r.email === "customer@example.com" || (r.reviewId && r.reviewId.startsWith("rev_seed_"))) {
          foundSeeded = true;
          continue;
        }
        if (r.helpfulCount === undefined || r.helpfulCount === null) {
          r.helpfulCount = 0;
        }
        cleanedList.push(JSON.stringify(r));
        
        const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating || 5))));
        counts[rating as 1 | 2 | 3 | 4 | 5]++;
        sum += rating;
        totalRatings++;

        r.verifiedPurchase = !!verifiedMap[r.email];

        const isDetailedReview = (r.comment && r.comment.trim() !== "") || (r.title && r.title.trim() !== "");
        if (isDetailedReview) {
          reviews.push(r);
        }
      } catch {
        // ignore malformed entries
      }
    }

    // purge seeded/fake reviews from Redis
    if (foundSeeded) {
      try {
        await redis.del(reviewsKey);
        if (cleanedList.length > 0) {
          await redis.rpush(reviewsKey, ...cleanedList);
        }
        console.info(`[Reviews API] Purged seeded reviews for product ${productId}`);
      } catch (purgeErr) {
        console.warn("[Reviews API] Failed to purge seeded reviews from Redis:", purgeErr);
      }
    }

    const average = totalRatings > 0 ? Number((sum / totalRatings).toFixed(1)) : 0;

    const stats = {
      total: totalRatings,
      average,
      distribution: {
        5: totalRatings > 0 ? Math.round((counts[5] / totalRatings) * 100) : 0,
        4: totalRatings > 0 ? Math.round((counts[4] / totalRatings) * 100) : 0,
        3: totalRatings > 0 ? Math.round((counts[3] / totalRatings) * 100) : 0,
        2: totalRatings > 0 ? Math.round((counts[2] / totalRatings) * 100) : 0,
        1: totalRatings > 0 ? Math.round((counts[1] / totalRatings) * 100) : 0,
      },
    };

    return NextResponse.json({ success: true, reviews, stats });
  } catch (error) {
    console.error("GET reviews error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}


export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: "Sign in to vote" }, { status: 401 });
    }
    const voterEmail = session.user.email;

    // rate limit: 10 votes/min per user
    try {
      const { success: rlOk } = await rateLimit(`ratelimit:review:helpful:${voterEmail}`, 10, 60);
      if (!rlOk) {
        return NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
      }
    } catch { /* non-critical */ }

    const { productId, reviewId } = await request.json();
    if (!productId || !reviewId) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
    }

    // one vote per user per review
    const voterSetKey = `dcart:review:${reviewId}:voters`;
    try {
      const added = await redis.sadd(voterSetKey, voterEmail);
      if (added === 0) {
        return NextResponse.json({ success: false, error: "You have already marked this review as helpful" }, { status: 409 });
      }
      await redis.expire(voterSetKey, 90 * 24 * 60 * 60); // 90-day TTL
    } catch (err) {
      console.warn("[Reviews API] Redis voter dedup check failed:", err);
      // fail-open — still increment
    }

    const reviewsKey = `dcart:product:${productId}:reviews`;
    let reviewsStrs: string[] = [];
    try {
      reviewsStrs = await redis.lrange(reviewsKey, 0, -1);
    } catch (err) {
      console.warn("[Reviews API] Redis lrange in PUT failed:", err);
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });
    }
    const updated: string[] = [];
    let found = false;

    for (const rStr of reviewsStrs) {
      try {
        const r = JSON.parse(rStr);
        if (r.reviewId === reviewId) {
          r.helpfulCount = (r.helpfulCount || 0) + 1;
          found = true;
        }
        updated.push(JSON.stringify(r));
      } catch {
        updated.push(rStr);
      }
    }

    if (found && updated.length > 0) {
      try {
        await redis.del(reviewsKey);
        await redis.rpush(reviewsKey, ...updated);
      } catch (err) {
        console.warn("[Reviews API] Redis write in PUT failed:", err);
        return NextResponse.json({ success: false, error: "Database write failed" }, { status: 503 });
      }
      return NextResponse.json({ success: true, message: "Review voted helpful" });
    }

    return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 });
  } catch (error) {
    console.error("PUT review vote error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
