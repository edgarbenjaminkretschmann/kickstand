// Simple in-memory fixed-window limiter. Enough for one Node process; resets on restart.

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Counts one hit for `key`. Returns false once more than `limit` hits fall into the current window. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) sweep(now);
    return true;
  }
  b.count++;
  return b.count <= limit;
}

function sweep(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** Best guess at the client address behind a reverse proxy. */
export function clientIp(request: Request, fallback = "unknown"): string {
  // Behind Cloudflare the edge sets cf-connecting-ip; elsewhere the reverse proxy sets X-Forwarded-For.
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || fallback;
}
