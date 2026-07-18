/**
 * Deterministic JSON serialization:
 * - object keys sorted recursively
 * - no whitespace
 * - arrays kept in order
 * - `undefined` is rejected (throws) anywhere in the value — canonicalization
 *   must never silently drop fields, or hashes would not be tamper-evident.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === undefined) {
    throw new TypeError("canonicalJson: undefined values are not allowed");
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = sortValue((value as Record<string, unknown>)[key]);
  }
  return out;
}

/** Chain anchor: prevHash of the first receipt of every run. */
export const GENESIS_HASH = "0".repeat(64);
