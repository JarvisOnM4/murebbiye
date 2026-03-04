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

/**
 * IP-based sliding window rate limiter using Upstash Redis.
 * Falls back to allow-all if Redis is not configured.
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const client = getRedis();

  if (!client) {
    // No Redis configured — allow all (dev mode)
    return { allowed: true, remaining: maxRequests, resetInSeconds: 0 };
  }

  const key = `rl:${action}:${ip}`;

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
    // Redis failure — fail open
    return { allowed: true, remaining: maxRequests, resetInSeconds: 0 };
  }
}
