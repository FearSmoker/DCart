import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/manageSession";
import { publishEvent } from "@/lib/kafka";
import { redis } from "@/lib/redis";
import { getProductsData } from "@/lib/getData";

export const GET = async () => {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { adminDB } = await import("@/firebaseAdmin");
    const userDoc = await adminDB.collection("users").doc(session.user.email).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.role === "seller") {
        return NextResponse.json(
          { success: false, message: "Sellers are not allowed to use wishlists" },
          { status: 403 }
        );
      }
    }

    const wishlistKey = `dcart:recommendations:${session.user.email}:wishlist`;
    const productIds = await redis.smembers(wishlistKey);

    if (!productIds || productIds.length === 0) {
      return NextResponse.json({ success: true, items: [] });
    }

    // fetch all products and filter by wishlist ids
    const allProducts = await getProductsData();
    const wishlistItems = allProducts.filter((p) => productIds.includes(p._id));

    return NextResponse.json({ success: true, items: wishlistItems, count: wishlistItems.length });
  } catch (error) {
    console.error("Wishlist GET error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const { productId, action } = await request.json();
    if (!productId || !action || (action !== "add" && action !== "remove")) {
      return NextResponse.json({ success: false, message: "Missing or invalid parameters" }, { status: 400 });
    }

    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "Unauthorized: Sign in required" }, { status: 401 });
    }

    const { adminDB } = await import("@/firebaseAdmin");
    const userDoc = await adminDB.collection("users").doc(session.user.email).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.role === "seller") {
        return NextResponse.json(
          { success: false, message: "Sellers are not allowed to use wishlists" },
          { status: 403 }
        );
      }
    }

    // sync directly to redis for immediate consistency
    const wishlistKey = `dcart:recommendations:${session.user.email}:wishlist`;
    if (action === "add") {
      await redis.sadd(wishlistKey, productId);
    } else {
      await redis.srem(wishlistKey, productId);
    }

    // send events to bus
    await publishEvent("wishlist-item", {
      email: session.user.email,
      productId,
      action,
    });

    return NextResponse.json({ success: true, message: `Product successfully ${action === "add" ? "added to" : "removed from"} wishlist` });
  } catch (error) {
    console.error("Wishlist action error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
};
