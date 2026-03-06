import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
};

const memoryStore = new Map<string, { count: number; expiresAt: number }>();

function checkMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: maxRequests - 1, resetInSeconds: windowSeconds };
  }

  entry.count += 1;
  const ttl = Math.ceil((entry.expiresAt - now) / 1000);

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetInSeconds: ttl,
  };
}

/**
 * IP-based sliding window rate limiter.
 * Uses Upstash Redis if configured, otherwise falls back to in-memory Map.
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `rl:${action}:${ip}`;
  const client = getRedis();

  if (!client) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[SECURITY] Rate limiter running in-memory mode — Redis not configured");
    }
    return checkMemoryRateLimit(key, maxRequests, windowSeconds);
  }

  try {
    const current = await client.incr(key);

    if (current === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttl = await client.ttl(key);

    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch {
    return checkMemoryRateLimit(key, maxRequests, windowSeconds);
  }
}
