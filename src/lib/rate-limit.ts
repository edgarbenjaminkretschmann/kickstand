// Rate limits. On Workers a rule with a `binding` uses the Workers Rate Limiting binding (wrangler.jsonc →
// ratelimits), which counts per Cloudflare location instead of per isolate. Everywhere else, and for rules
// without a binding, a simple in-memory fixed window: enough for one Node process, resets on restart.
// The binding only knows 10 s and 60 s periods, so its numbers are the per-minute version of the local ones.
import { binding } from "./env";

export interface Rule {
  name: string;
  /** In-memory limit: hits allowed per window. */
  limit: number;
  windowMs: number;
  /** Name of the Workers rate-limit binding that replaces the in-memory count there. */
  binding?: string;
}

export const RULES = {
  /** 30 per IP / 10 attempts per e-mail in 10 minutes locally; 20 / 5 a minute on Workers. */
  loginIp: { name: "login:ip", limit: 30, windowMs: 10 * 60_000, binding: "LOGIN_IP_LIMITER" },
  loginEmail: { name: "login:email", limit: 10, windowMs: 10 * 60_000, binding: "LOGIN_EMAIL_LIMITER" },
  /** 10 messages a minute (binding on Workers) and 120 an hour (in memory everywhere). */
  messageMinute: { name: "msg:min", limit: 10, windowMs: 60_000, binding: "MESSAGE_LIMITER" },
  messageHour: { name: "msg:hour", limit: 120, windowMs: 3_600_000 },
} satisfies Record<string, Rule>;

/** Counts one hit for `key` under `rule`. False means: over the limit, refuse. */
export async function allow(rule: Rule, key: string): Promise<boolean> {
  const id = `${rule.name}:${key}`;
  const limiter = rule.binding ? binding<RateLimit>(rule.binding) : undefined;
  if (limiter) return (await limiter.limit({ key: id })).success;
  return hit(id, rule.limit, rule.windowMs);
}

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
