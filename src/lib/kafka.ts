import { Kafka, Producer, Consumer } from "kafkajs";
import { EventEmitter } from "events";
import { redis } from "./redis";
import { publishInventoryUpdate, publishNotification } from "./pubsub";
import { queueOrderJobs } from "./queues";
import { ProductData } from "../../types";
import { publishRealtime } from "./realtime";
import { adminDB } from "@/firebaseAdmin";

// typescript interfaces for event payloads
export interface OrderCreatedPayload {
  orderId: string;
  email: string;
  amount: number;
  items: Array<{
    _id: string;
    quantity: number;
    title?: string;
  }>;
}

export interface OrderCancelledPayload {
  orderId: string;
  email: string;
  amount: number;
  items: Array<{
    _id: string;
    quantity: number;
    title?: string;
  }>;
}

export interface PaymentSuccessPayload {
  orderId: string;
  email: string;
  amount: number;
}

export interface ReviewAddedPayload {
  reviewId: string;
  productId: string;
  email: string;
  rating: number;
  comment: string;
}

export interface ViewItemPayload {
  email: string;
  productId: string;
}

export interface SearchItemPayload {
  email: string;
  query: string;
}

export interface WishlistItemPayload {
  email: string;
  productId: string;
  action: "add" | "remove";
}

// send events to bus
class MockEventBus extends EventEmitter {
  async publish(topic: string, message: string): Promise<void> {
    // simulate broker network latency asynchronously
    setImmediate(() => {
      this.emit(topic, message);
    });
  }
}

// kafka initialization
const kafkaBrokers = process.env.KAFKA_BROKERS;
let kafka: Kafka | null = null;
let producer: Producer | null = null;
let mockBus: MockEventBus | null = null;

if (kafkaBrokers) {
  kafka = new Kafka({
    clientId: "dcart-app",
    brokers: kafkaBrokers.split(","),
  });
  producer = kafka.producer();
  producer.connect().catch((err) => {
    console.error("[Kafka] Failed to connect producer:", err);
  });
} else {
  mockBus = new MockEventBus();
}

// publish function
export async function publishEvent<T>(topic: string, payload: T): Promise<void> {
  const messageStr = JSON.stringify(payload);

  if (kafka && producer) {
    try {
      await producer.send({
        topic,
        messages: [{ value: messageStr }],
      });
    } catch (err) {
      console.error(`[Kafka] Failed to publish message to topic "${topic}":`, err);
      // fallback to mock bus to ensure...
      if (!mockBus) mockBus = new MockEventBus();
      await mockBus.publish(topic, messageStr);
    }
  } else {
    if (!mockBus) mockBus = new MockEventBus();
    await mockBus.publish(topic, messageStr);
  }
}

// --- consumer services implementation ---

interface Variant {
  color: string;
  model?: string;
  images: string[];
  price?: number;
  quantity?: number;
}

// 1. inventory service
async function handleInventoryEvent(topic: string, payloadStr: string) {
  try {
    const data = JSON.parse(payloadStr);
    if (topic === "order-created") {
      const payload = data as OrderCreatedPayload;
      console.log(`[Inventory Service Consumer] Processing order-created for Order ${payload.orderId}...`);
      for (const item of payload.items) {
        const stockKey = `dcart:stock:${item._id}`;
        const qtyToDecr = item.quantity || 1;

        let newStock = 0;
        try {
          // fetch current product to check variants and vendorid
          const productDoc = await adminDB.collection("products").doc(item._id).get();
          if (productDoc.exists) {
            const productData = productDoc.data();
            const vendorId = productData?.vendorId;
            let variants: Variant[] = productData?.variants || [];
            
            // check and update matching variant if exist
            if (variants.length > 0) {
              variants = variants.map((v: Variant) => {
                const variantStr = v.model ? `${v.color} - ${v.model}` : v.color;
                const suffix = `(${variantStr})`;
                if (item.title && item.title.includes(suffix)) {
                  return {
                    ...v,
                    quantity: Math.max(0, (v.quantity || 0) - qtyToDecr),
                  };
                }
                return v;
              });
            }

            // calculate new total stock
            if (variants.length > 0) {
              newStock = variants.reduce((sum: number, v: Variant) => sum + (v.quantity || 0), 0);
            } else {
              const currentQty = Number(productData?.quantity || 0);
              newStock = Math.max(0, currentQty - qtyToDecr);
            }

            // sync firestore root products collection
            await adminDB.collection("products").doc(item._id).update({
              quantity: newStock,
              variants,
            });

            // sync firestore vendor products subcollection
            if (vendorId) {
              await adminDB
                .collection("vendors")
                .doc(vendorId)
                .collection("products")
                .doc(item._id)
                .update({
                  quantity: newStock,
                  variants,
                });
            }
          } else {
            // fallback to simple redis decrement if...
            const redisVal = await redis.decrby(stockKey, qtyToDecr);
            newStock = Number(redisVal);
          }

          // sync redis
          await redis.set(stockKey, String(newStock));
          await publishInventoryUpdate(item._id, newStock);
          await publishRealtime({ type: "inventory:updated", data: { productId: item._id, stock: newStock } });
          console.log(`[Inventory Service Consumer] Updated stock of item ${item._id} to ${newStock}`);
        } catch (dbErr) {
          console.error(`[Inventory Service Consumer] DB sync error for item ${item._id}:`, dbErr);
        }
      }
    } else if (topic === "order-cancelled") {
      const payload = data as OrderCancelledPayload;
      console.log(`[Inventory Service Consumer] Processing order-cancelled for Order ${payload.orderId}...`);
      for (const item of payload.items) {
        const stockKey = `dcart:stock:${item._id}`;
        const qtyToIncr = item.quantity || 1;

        let newStock = 0;
        try {
          const productDoc = await adminDB.collection("products").doc(item._id).get();
          if (productDoc.exists) {
            const productData = productDoc.data();
            const vendorId = productData?.vendorId;
            let variants: Variant[] = productData?.variants || [];
            
            // check and update matching variant
            if (variants.length > 0) {
              variants = variants.map((v: Variant) => {
                const variantStr = v.model ? `${v.color} - ${v.model}` : v.color;
                const suffix = `(${variantStr})`;
                if (item.title && item.title.includes(suffix)) {
                  return {
                    ...v,
                    quantity: (v.quantity || 0) + qtyToIncr,
                  };
                }
                return v;
              });
            }

            // calculate new total stock
            if (variants.length > 0) {
              newStock = variants.reduce((sum: number, v: Variant) => sum + (v.quantity || 0), 0);
            } else {
              const currentQty = Number(productData?.quantity || 0);
              newStock = currentQty + qtyToIncr;
            }

            // sync firestore root products collection
            await adminDB.collection("products").doc(item._id).update({
              quantity: newStock,
              variants,
            });

            // sync firestore vendor products subcollection
            if (vendorId) {
              await adminDB
                .collection("vendors")
                .doc(vendorId)
                .collection("products")
                .doc(item._id)
                .update({
                  quantity: newStock,
                  variants,
                });
            }
          } else {
            const redisVal = await redis.incrby(stockKey, qtyToIncr);
            newStock = Number(redisVal);
          }

          // sync redis
          await redis.set(stockKey, String(newStock));
          await publishInventoryUpdate(item._id, newStock);
          await publishRealtime({ type: "inventory:updated", data: { productId: item._id, stock: newStock } });
          console.log(`[Inventory Service Consumer] Restored stock of item ${item._id} to ${newStock}`);
        } catch (dbErr) {
          console.error(`[Inventory Service Consumer] DB sync error during cancellation for item ${item._id}:`, dbErr);
        }
      }
    }
  } catch (err) {
    console.error(`[Inventory Service Consumer] Error handling topic ${topic}:`, err);
  }
}

// 2. notification service
async function handleNotificationEvent(topic: string, payloadStr: string) {
  try {
    const data = JSON.parse(payloadStr);
    if (topic === "order-created") {
      const payload = data as OrderCreatedPayload;
      console.log(`[Notification Service Consumer] Processing order-created for Order ${payload.orderId}...`);
      // trigger socket.io notification toast
      await publishNotification(
        "New Order!",
        `Order ${payload.orderId.substring(0, 8)}... has been placed successfully by ${payload.email}.`,
        "order_placed"
      );
      // queue bullmq confirmation email and tasks
      await queueOrderJobs(payload.email, payload.orderId, payload.amount, payload.items as unknown as ProductData[]);
    } else if (topic === "payment-success") {
      const payload = data as PaymentSuccessPayload;
      console.log(`[Notification Service Consumer] Processing payment-success for Order ${payload.orderId}...`);
      await publishNotification(
        "Payment Succeeded!",
        `Payment of $${payload.amount} for Order ${payload.orderId.substring(0, 8)}... was received successfully.`,
        "payment_success"
      );
    } else if (topic === "review-added") {
      const payload = data as ReviewAddedPayload;
      console.log(`[Notification Service Consumer] Processing review-added for product ${payload.productId}...`);
      await publishNotification(
        "New Customer Review!",
        `Rating: ${payload.rating}/5. "${payload.comment.substring(0, 30)}${payload.comment.length > 30 ? "..." : ""}"`,
        "review_added"
      );
    }
  } catch (err) {
    console.error(`[Notification Service Consumer] Error handling topic ${topic}:`, err);
  }
}

// 3. analytics service
async function handleAnalyticsEvent(topic: string, payloadStr: string) {
  try {
    const data = JSON.parse(payloadStr);
    const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

    if (topic === "order-created") {
      const payload = data as OrderCreatedPayload;
      console.log(`[Analytics Service Consumer] Tracking checkout: Order ${payload.orderId}...`);
      await redis.incr("dcart:analytics:total_orders");
      await redis.hincrby(`dcart:analytics:daily_sales:${today}`, "orders", 1);

      // load products from cache to resolve categories
      let products: ProductData[] = [];
      try {
        const cachedProducts = await redis.get("dcart:products");
        if (cachedProducts) {
          products = JSON.parse(cachedProducts);
        }
      } catch (err) {
        console.warn("Failed to read cached products for analytics:", err);
      }

      for (const item of payload.items) {
        await redis.zincrby("dcart:analytics:top_products", item.quantity || 1, item._id);

        const matchedProduct = products.find((p) => p._id === item._id);
        if (matchedProduct && matchedProduct.category) {
          for (const cat of matchedProduct.category) {
            await redis.zincrby("dcart:analytics:top_categories", item.quantity || 1, cat.name);
          }
        }
      }
    } else if (topic === "order-cancelled") {
      const payload = data as OrderCancelledPayload;
      console.log(`[Analytics Service Consumer] Tracking cancellation: Order ${payload.orderId}...`);
      await redis.decr("dcart:analytics:total_orders");
      await redis.hincrby(`dcart:analytics:daily_sales:${today}`, "orders", -1);
      await redis.incrbyfloat("dcart:analytics:total_revenue", -payload.amount);
      await redis.hincrbyfloat(`dcart:analytics:daily_sales:${today}`, "revenue", -payload.amount);

      let products: ProductData[] = [];
      try {
        const cachedProducts = await redis.get("dcart:products");
        if (cachedProducts) {
          products = JSON.parse(cachedProducts);
        }
      } catch (err) {
        console.warn("Failed to read cached products for analytics cancellation:", err);
      }

      for (const item of payload.items) {
        await redis.zincrby("dcart:analytics:top_products", -(item.quantity || 1), item._id);

        const matchedProduct = products.find((p) => p._id === item._id);
        if (matchedProduct && matchedProduct.category) {
          for (const cat of matchedProduct.category) {
            await redis.zincrby("dcart:analytics:top_categories", -(item.quantity || 1), cat.name);
          }
        }
      }
    } else if (topic === "payment-success") {
      const payload = data as PaymentSuccessPayload;
      console.log(`[Analytics Service Consumer] Tracking revenue: +$${payload.amount}...`);
      await redis.incrbyfloat("dcart:analytics:total_revenue", payload.amount);
      await redis.hincrbyfloat(`dcart:analytics:daily_sales:${today}`, "revenue", payload.amount);
    }

    // publish live analytics update
    await publishRealtime({ type: "analytics:updated", data: {} });
  } catch (err) {
    console.error(`[Analytics Service Consumer] Error handling topic ${topic}:`, err);
  }
}

// 4. recommendation service
async function handleRecommendationEvent(topic: string, payloadStr: string) {
  try {
    const data = JSON.parse(payloadStr);
    if (topic === "order-created") {
      const payload = data as OrderCreatedPayload;
      console.log(`[Recommendation Service Consumer] Recording purchase interactions for user ${payload.email}...`);
      for (const item of payload.items) {
        await redis.sadd(`dcart:recommendations:${payload.email}:purchases`, item._id);
      }
    } else if (topic === "review-added") {
      const payload = data as ReviewAddedPayload;
      console.log(`[Recommendation Service Consumer] Recording review interaction for user ${payload.email}...`);
      await redis.hset(
        `dcart:recommendations:${payload.email}:reviews`,
        payload.productId,
        String(payload.rating)
      );
    } else if (topic === "view-item") {
      const payload = data as ViewItemPayload;
      console.log(`[Recommendation Service Consumer] Recording view interaction for user ${payload.email}...`);
      await redis.sadd(`dcart:recommendations:${payload.email}:views`, payload.productId);
    } else if (topic === "search-item") {
      const payload = data as SearchItemPayload;
      console.log(`[Recommendation Service Consumer] Recording search interaction for user ${payload.email}...`);
      await redis.sadd(`dcart:recommendations:${payload.email}:searches`, payload.query);
    } else if (topic === "wishlist-item") {
      const payload = data as WishlistItemPayload;
      console.log(`[Recommendation Service Consumer] Recording wishlist action "${payload.action}" for user ${payload.email}...`);
      if (payload.action === "add") {
        await redis.sadd(`dcart:recommendations:${payload.email}:wishlist`, payload.productId);
      } else {
        await redis.srem(`dcart:recommendations:${payload.email}:wishlist`, payload.productId);
      }
    }
  } catch (err) {
    console.error(`[Recommendation Service Consumer] Error handling topic ${topic}:`, err);
  }
}

// singleton state to prevent registering duplicate...
const globalForKafkaConsumers = globalThis as unknown as {
  consumersInitialized?: boolean;
  kafkaConsumers?: Consumer[];
};

export async function initKafkaConsumers(): Promise<void> {
  if (globalForKafkaConsumers.consumersInitialized) {
    return;
  }

  const topics = ["order-created", "order-cancelled", "payment-success", "review-added", "view-item", "search-item", "wishlist-item"];

  if (kafka) {
    try {
      const consumer = kafka.consumer({ groupId: "dcart-group" });
      await consumer.connect();
      await consumer.subscribe({ topics, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          const payloadStr = message.value?.toString() || "";

          // route to services
          if (topic === "order-created" || topic === "order-cancelled") {
            await handleInventoryEvent(topic, payloadStr);
          }
          if (topic === "order-created" || topic === "payment-success" || topic === "review-added") {
            await handleNotificationEvent(topic, payloadStr);
          }
          if (topic === "order-created" || topic === "order-cancelled" || topic === "payment-success") {
            await handleAnalyticsEvent(topic, payloadStr);
          }
          if (topic === "order-created" || topic === "review-added" || topic === "view-item" || topic === "search-item" || topic === "wishlist-item") {
            await handleRecommendationEvent(topic, payloadStr);
          }
        },
      });

      globalForKafkaConsumers.kafkaConsumers = [consumer];
    } catch (err) {
      console.error("[Kafka] Failed to initialize consumer loop, falling back to mock bus listeners:", err);
      setupMockBusListeners(topics);
    }
  } else {
    setupMockBusListeners(topics);
  }

  globalForKafkaConsumers.consumersInitialized = true;
}

function setupMockBusListeners(topics: string[]) {
  if (!mockBus) mockBus = new MockEventBus();

  topics.forEach((topic) => {
    mockBus!.on(topic, async (payloadStr: string) => {
      console.log(`[Mock Consumer] Received event on topic "${topic}"`);
      if (topic === "order-created" || topic === "order-cancelled") {
        await handleInventoryEvent(topic, payloadStr);
      }
      if (topic === "order-created" || topic === "payment-success" || topic === "review-added") {
        await handleNotificationEvent(topic, payloadStr);
      }
      if (topic === "order-created" || topic === "order-cancelled" || topic === "payment-success") {
        await handleAnalyticsEvent(topic, payloadStr);
      }
      if (topic === "order-created" || topic === "review-added" || topic === "view-item" || topic === "search-item" || topic === "wishlist-item") {
        await handleRecommendationEvent(topic, payloadStr);
      }
    });
  });
}
