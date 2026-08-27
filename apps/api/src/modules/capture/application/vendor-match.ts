/**
 * Score vendor name match. Higher is better (0–100).
 * Exact (case-insensitive) > starts-with > contains > token overlap.
 */
export function scoreVendorName(
  raw: string,
  vendorName: string,
): number {
  const a = normalize(raw);
  const b = normalize(vendorName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.startsWith(a) || a.startsWith(b)) return 85;
  if (b.includes(a) || a.includes(b)) return 70;

  const aTokens = new Set(a.split(' ').filter((t) => t.length > 1));
  const bTokens = b.split(' ').filter((t) => t.length > 1);
  if (aTokens.size === 0 || bTokens.length === 0) return 0;
  const overlap = bTokens.filter((t) => aTokens.has(t)).length;
  const ratio = overlap / Math.max(aTokens.size, bTokens.length);
  if (ratio >= 0.6) return Math.round(55 + ratio * 20);
  if (ratio >= 0.4) return Math.round(40 + ratio * 20);
  return 0;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const VENDOR_MATCH_THRESHOLD = 55;
