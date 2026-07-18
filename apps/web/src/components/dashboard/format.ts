export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "$0.00";
  if (Math.abs(usd) < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "0ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function truncateHash(hash: string): string {
  return hash.slice(0, 8);
}

export function truncateLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
