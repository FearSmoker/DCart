import Container from "@/components/Container";
import ProductDetailView from "@/components/ProductDetailView";
import RecommendedProducts from "@/components/RecommendedProducts";
import AIReviewInsights from "@/components/AIReviewInsights";

import { notFound } from "next/navigation";
import { redis } from "@/lib/redis";
import { getSession } from "@/lib/manageSession";
import { publishEvent } from "@/lib/kafka";
import { getProductsData } from "@/lib/getData";
import { adminDB } from "@/firebaseAdmin";

interface Props {
  params: {
    slug: string;
  };
}

const SingleProductPage = async ({ params: { slug } }: Props) => {
  const products = await getProductsData();
  const product = products.find((p) => p.slug.current === slug) || null;

  if (!product) {
    notFound();
  }

  const session = await getSession();
  let isConsumer = false;
  let purchaseInfo: { date: string; orderId: string } | null = null;

  if (session?.user?.email) {
    const email = session.user.email;
    try {
      const userDoc = await adminDB.collection("users").doc(email).get();
      const role = userDoc.exists ? userDoc.data()?.role : "consumer";
      isConsumer = role === "consumer";

      if (isConsumer) {
        const snapshot = await adminDB
          .collection("users")
          .doc(email)
          .collection("orders")
          .get();

        const orders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<{ id: string; timestamp?: string; value?: { status?: string; items?: Array<{ _id: string }> } }>;

        const matchedOrder = orders.find((o) => {
          const items = o.value?.items || [];
          const containsProduct = items.some((item) => item._id === product._id);
          const status = o.value?.status;
          const isCancelled = status === "Cancelled" || status === "Cancelled as Fraud";
          return containsProduct && !isCancelled;
        });

        if (matchedOrder) {
          const orderDate = matchedOrder.timestamp
            ? new Date(matchedOrder.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "recently";
          purchaseInfo = {
            date: orderDate,
            orderId: matchedOrder.id,
          };
        }
      }
    } catch (err) {
      console.warn("Failed to check user role/orders in Firestore:", err);
    }
  }

  // update analytics
  if (isConsumer && session?.user?.email) {
    const email = session.user.email;
    const viewKey = `dcart:analytics:product_viewers:${product._id}`;
    try {
      const isNew = await redis.sadd(viewKey, email);
      if (isNew === 1) {
        await redis.incr(`dcart:analytics:product_views:${product._id}`);
        await redis.incr("dcart:analytics:total_views");
        // update the top_products sorted set so...
        await redis.zincrby("dcart:analytics:top_products", 1, product._id);
      }
      // Track unique consumer visitor globally
      await redis.sadd("dcart:analytics:unique_consumers_set", email);
    } catch (err) {
      console.warn("Failed to increment unique views in Redis:", err);
    }
  }

  // ── publish view-item event for logged-in...
  try {
    if (session?.user?.email) {
      await publishEvent("view-item", {
        email: session.user.email,
        productId: product._id,
      });
    }
  } catch (err) {
    console.warn("Failed to publish view-item event:", err);
  }

  return (
    <Container className="my-10 bg-bgLight">
      <ProductDetailView product={product} purchaseInfo={purchaseInfo} />
      <AIReviewInsights productId={product._id} />
      <RecommendedProducts type="also-bought" productId={product._id} title="Customers Also Bought" />
    </Container>
  );
};

export default SingleProductPage;
