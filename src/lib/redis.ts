import Redis from "ioredis";

// Silence BullMQ eviction warning (since Upstash/managed Redis restricts CONFIG changes)
if (typeof window === "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args[0] && String(args[0]).includes("Eviction policy is")) {
      return;
    }
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (args[0] && String(args[0]).includes("Eviction policy is")) {
      return;
    }
    originalError(...args);
  };
}

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableAutoPipelining: true,
    lazyConnect: true,
  });

// Defer config to the ready event to prevent build-time connection attempts
redis.on("ready", () => {
  redis.config("SET", "maxmemory-policy", "noeviction").catch(() => {
    // Expected on Upstash — CONFIG SET is restricted. Ignore silently.
  });
});

redis.on("error", (err) => {
  // filter out noisy connection noise
  if (!String(err).includes("ERR max number of clients") && !String(err).includes("ECONNRESET")) {
    console.error("[Redis] Connection error:", err.message);
  }
});

globalForRedis.redis = redis;

