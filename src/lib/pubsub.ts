import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const globalForPub = globalThis as unknown as { pub: Redis };
export const pub =
  globalForPub.pub ||
  new Redis(redisUrl, {
    lazyConnect: true,
  });

pub.on("error", (err) => {
  // catch and silence expected client limit...
  if (!String(err).includes("ERR max number of clients") && !String(err).includes("ECONNRESET")) {
    console.error("[PubSub Redis] Connection error:", err.message);
  }
});

globalForPub.pub = pub;


export async function publishInventoryUpdate(productId: string, quantityLeft: number) {
  try {
    await pub.publish("inventory", JSON.stringify({ productId, quantityLeft }));
    console.log(`[Redis Pub] Published inventory update for ${productId}: ${quantityLeft} left.`);
  } catch (err) {
    console.error("Redis publish error for inventory:", err);
  }
}

export async function publishNotification(title: string, message: string, type: string) {
  try {
    await pub.publish(
      "notifications",
      JSON.stringify({ title, message, type, timestamp: new Date() })
    );
    console.log(`[Redis Pub] Published notification: ${title}`);
  } catch (err) {
    console.error("Redis publish error for notifications:", err);
  }
}
