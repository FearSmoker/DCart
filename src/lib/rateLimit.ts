import { redis } from "./redis";

export async function rateLimit(key: string, limit: number, windowSecs: number) {
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSecs);
    }
    return {
      success: current <= limit,
      limit,
      remaining: Math.max(0, limit - current),
    };
  } catch (error) {
    console.error("Redis rate limit error:", error);
    // graceful fallback: fail open so users...
    return {
      success: true,
      limit,
      remaining: limit,
    };
  }
}
