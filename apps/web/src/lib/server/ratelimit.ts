// Tiny in-memory fixed-window rate limiter. Process-local — replace with a
// shared store (e.g. Redis) before running more than one instance.
const windows = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the call is allowed, false if the limit is exhausted. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
