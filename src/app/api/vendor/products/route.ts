import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { auth } from "@/auth";
import { publishRealtime } from "@/lib/realtime";
import { redis } from "@/lib/redis";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  // fetch products for a specific vendor...
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { role, vendorId: userVendorId } = session.user as { role?: string; vendorId?: string };
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendor_id");

    if (!vendorId) {
      return NextResponse.json({ success: false, error: "vendor_id required" }, { status: 400 });
    }

    if (role !== "admin" && (role !== "seller" || userVendorId !== vendorId)) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    // fetch products from vendor subcollection (excludes placeholder doc)
    const snapshot = await adminDB
      .collection("vendors")
      .doc(vendorId)
      .collection("products")
      .where("__name__", "!=", "placeholder")
      .get();

    const products = snapshot.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    })) as Array<Record<string, unknown>>;

    // overlay each product's quantity with the...
    // redis is the source of truth...
    // save order to firestore
    try {
      await Promise.all(
        products.map(async (product) => {
          const redisStock = await redis.get(`dcart:stock:${product._id}`);
          if (redisStock !== null) {
            product.quantity = parseInt(redisStock, 10);
          }
        })
      );
    } catch (redisErr) {
      console.warn("[Vendor Products] Failed to overlay Redis stock:", redisErr);
    }

    return NextResponse.json({ success: true, products, total: products.length });
  } catch (error) {
    console.error("Failed to fetch vendor products:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // fetch user details dynamically to confirm...
    const email = session.user.email;
    const userDoc = await adminDB.collection("users").doc(email as string).get();
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const isApprovedSeller = userData?.role === "seller" && userData?.sellerStatus === "approved";
    const vendorId = userData?.vendorId;

    if (!isApprovedSeller || !vendorId) {
      return NextResponse.json({ success: false, error: "Access Denied: Only approved sellers can list products" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      price,
      category,
      type,
      variants,
      customFields,
      material,
      modelInfo,
      brand,
      materialsCare,
      featuresSpecs,
      measurements,
      inTheBox,
    } = body;

    if (!title || !description || !price || !category || !type || !variants || variants.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: title, description, price, category, type, and at least one variant" },
        { status: 400 }
      );
    }

    const productId = `prod_${Date.now()}`;
    
    // generate url slug from title
    const slugString = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const slug = `${slugString}-${Math.floor(1000 + Math.random() * 9000)}`;

    // calculate total quantity across all variants
    const totalQuantity = variants.reduce((sum: number, v: { quantity: number }) => sum + (Number(v.quantity) || 0), 0);

    const productPayload = {
      _id: productId,
      title,
      description,
      price: Number(price),
      rowprice: Number(price) * 1.2, // standard retail markdown markup
      category,
      type,
      slug,
      variants: variants.map((v: { color: string; model?: string; images: string[]; price?: number; quantity: number }) => ({
        color: v.color,
        model: v.model || "",
        images: v.images || [],
        price: Number(v.price) || Number(price),
        quantity: Number(v.quantity) || 0,
      })),
      customFields: customFields || {},
      material: material || null,
      modelInfo: modelInfo || null,
      brand: brand || "Generic",
      materialsCare: materialsCare || [],
      featuresSpecs: featuresSpecs || [],
      measurements: measurements || [],
      inTheBox: inTheBox || [],
      vendorId,
      ratings: 5.0,
      quantity: totalQuantity || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // save globally to 'products' collection
    await adminDB.collection("products").doc(productId).set(productPayload);

    // save to vendor's subcollection for vendor dashboard queries
    await adminDB
      .collection("vendors")
      .doc(vendorId)
      .collection("products")
      .doc(productId)
      .set(productPayload);

    // initialize stock in redis and invalidate products cache
    try {
      await redis.set(`dcart:stock:${productId}`, String(productPayload.quantity));
      await redis.del("dcart:products");
    } catch (redisErr) {
      console.warn("Failed to initialize Redis cache for new product:", redisErr);
    }

    // increment vendor product count
    try {
      const vendorRef = adminDB.collection("vendors").doc(vendorId);
      const vendorSnap = await vendorRef.get();
      if (vendorSnap.exists) {
        const vData = vendorSnap.data();
        const count = (vData?.product_count || 0) + 1;
        await vendorRef.update({ product_count: count });
      }
    } catch (err) {
      console.warn("Failed to increment vendor product count:", err);
    }

    // publish real-time event
    try {
      await publishRealtime({
        type: "product:created",
        data: { vendorId, productId, title }
      });
    } catch (err) {
      console.warn("Failed to publish product:created event:", err);
    }

    return NextResponse.json({
      success: true,
      productId,
      slug,
      message: "Product listed successfully!",
    });
  } catch (error) {
    console.error("Failed to list product:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
