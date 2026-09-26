type Window = { timestamps: number[] };

const buckets = new Map<string, Window>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

/**
 * Returns { allowed, remaining, resetInMs }. In-memory only — resets on
 * server restart and is per-instance, not shared across multiple serverless
 * instances. Fine for a single Next.js deployment (e.g. one Vercel/Node
 * process); swap for Redis/Upstash if you ever scale to multiple instances.
 */
export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
} {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    const oldest = bucket.timestamps[0];
    return { allowed: false, remaining: 0, resetInMs: oldest + WINDOW_MS - now };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - bucket.timestamps.length,
    resetInMs: WINDOW_MS,
  };
}

export function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}