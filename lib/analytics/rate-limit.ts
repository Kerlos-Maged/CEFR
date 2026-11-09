const buckets = new Map<string, { startedAt: number; count: number }>();

/** Process-local backstop for analytics floods. Keys must already be opaque hashes. */
export function consumeAnalyticsQuota(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
  } else {
    if (bucket.count >= limit) return false;
    bucket.count += 1;
  }

  if (buckets.size > 10_000) {
    for (const [entryKey, entry] of buckets) {
      if (now - entry.startedAt >= windowMs * 2) buckets.delete(entryKey);
    }
  }
  return true;
}
