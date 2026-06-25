import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { publishEvent } from "@/lib/kafka";
import { publishRealtime } from "@/lib/realtime";

export const POST = async (request: NextRequest) => {
  try {
    const { productId, email, rating, comment, title, images } = await request.json();
    if (!productId || !email || rating === undefined) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.email || session.user.email !== email) {
      return NextResponse.json({ success: false, message: "Unauthorized: Invalid session" }, { status: 401 });
    }

    // reject reviews from sellers
    const { adminDB } = await import("@/firebaseAdmin");
    const userDoc = await adminDB.collection("users").doc(email).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.role === "seller") {
        return NextResponse.json(
          { success: false, message: "Sellers are not allowed to review or rate products" },
          { status: 403 }
        );
      }
    }

    const parsedRating = Number(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ success: false, message: "Rating must be a number between 1 and 5" }, { status: 400 });
    }

    const reviewsKey = `dcart:product:${productId}:reviews`;

    // ── upsert logic: each user can...
    // read all existing reviews, find if...
    let existingReviews: string[] = [];
    try {
      existingReviews = await redis.lrange(reviewsKey, 0, -1);
    } catch {
      // redis unavailable — treat as empty
    }

    const timestamp = new Date().toISOString();
    let existingReviewId: string | null = null;

    // check for an existing entry from this user
    for (const rStr of existingReviews) {
      try {
        const r = JSON.parse(rStr);
        if (r.email === email) {
          existingReviewId = r.reviewId;
          break;
        }
      } catch {
        // ignore malformed
      }
    }

    // build the review object — preserve...
    const reviewId = existingReviewId ?? ("rev_" + Math.random().toString(36).substring(2, 11));

    const reviewData = {
      reviewId,
      email,
      rating: parsedRating,
      comment: (comment || "").trim().slice(0, 2000),
      title: (title || "").trim().slice(0, 200),
      images: Array.isArray(images) ? images.slice(0, 5) : [],
      timestamp,
      helpfulCount: 0,
    };

    if (existingReviewId) {
      // update: rebuild the list without the...
      const updatedList = existingReviews
        .map((rStr) => {
          try {
            const r = JSON.parse(rStr);
            // replace the matching entry
            if (r.email === email) return JSON.stringify(reviewData);
            return rStr;
          } catch {
            return rStr;
          }
        })
        // also strip any legacy seeded entries during rebuild
        .filter((rStr) => {
          try {
            const r = JSON.parse(rStr);
            if (r.email === "customer@example.com") return false;
            if (r.reviewId && r.reviewId.startsWith("rev_seed_")) return false;
            return true;
          } catch {
            return true;
          }
        });

      // atomically replace the list
      await redis.del(reviewsKey);
      if (updatedList.length > 0) {
        await redis.rpush(reviewsKey, ...updatedList);
      }
    } else {
      // create: push as a new entry...
      const cleanedExisting = existingReviews.filter((rStr) => {
        try {
          const r = JSON.parse(rStr);
          if (r.email === "customer@example.com") return false;
          if (r.reviewId && r.reviewId.startsWith("rev_seed_")) return false;
          return true;
        } catch {
          return true;
        }
      });

      if (cleanedExisting.length !== existingReviews.length) {
        // rebuild without seeded entries, then add new review
        await redis.del(reviewsKey);
        const toWrite = [...cleanedExisting, JSON.stringify(reviewData)];
        await redis.rpush(reviewsKey, ...toWrite);
      } else {
        // no seeded entries — just push...
        await redis.lpush(reviewsKey, JSON.stringify(reviewData));
      }
    }

    // ── recalculate average rating from all...
    const reviewsStrs = await redis.lrange(reviewsKey, 0, -1);
    let sum = 0;
    let total = 0;
    for (const rStr of reviewsStrs) {
      try {
        const r = JSON.parse(rStr);
        if (r.email === "customer@example.com" || (r.reviewId && r.reviewId.startsWith("rev_seed_"))) {
          continue;
        }
        sum += Number(r.rating || 5);
        total++;
      } catch {
        // ignore malformed
      }
    }

    const newAverage = total > 0 ? Number((sum / total).toFixed(1)) : parsedRating;

    // ── store new average rating &...
    await redis.set(`dcart:product:${productId}:rating`, String(newAverage));
    await redis.set(`dcart:product:${productId}:ratingCount`, String(total));

    // ── update firestore if the product...
    try {
      const { adminDB } = await import("@/firebaseAdmin");
      const productRef = adminDB.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (productDoc.exists) {
        await productRef.update({ ratings: newAverage, ratingCount: total });
      }
    } catch (fireErr) {
      console.warn("[Add Review API] Failed to update ratings in Firestore:", fireErr);
    }

    // ── invalidate products list cache ──
    await redis.del("dcart:products");

    // ── publish event for notification/analytics asynchronously ──
    try {
      await publishEvent("review-added", {
        reviewId,
        productId,
        email,
        rating: parsedRating,
        comment: (comment || "").trim().slice(0, 2000),
        title: (title || "").trim().slice(0, 200),
        images: Array.isArray(images) ? images.slice(0, 5) : [],
      });
    } catch (kafkaErr) {
      console.warn("[Add Review API] Failed to publish review-added event:", kafkaErr);
    }

    // websocket broadcast
    await publishRealtime({ type: "review:added", data: { productId, rating: Number(rating) } });

    const action = existingReviewId ? "updated" : "created";
    return NextResponse.json({
      success: true,
      message: `Review ${action} successfully`,
      review: reviewData,
    });
  } catch (error) {
    console.error("Add review error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
};
