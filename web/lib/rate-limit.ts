export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

interface RateLimitEntry {
  count: number;
  reset: number;
}

const stores = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per IP

export function rateLimit(identifier: string, maxRequests = MAX_REQUESTS): RateLimitResult {
  const now = Date.now();
  const entry = stores.get(identifier);
  if (!entry || now >= entry.reset) {
    stores.set(identifier, { count: 1, reset: now + WINDOW_MS });
    return { allowed: true, remaining: maxRequests - 1, reset: now + WINDOW_MS };
  }
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, reset: entry.reset };
  }
  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, reset: entry.reset };
}

export function getRateLimitKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const realIp = headers.get("x-real-ip");
  return realIp || ip;
}

export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of stores.entries()) {
    if (now >= entry.reset) {
      stores.delete(key);
    }
  }
}
