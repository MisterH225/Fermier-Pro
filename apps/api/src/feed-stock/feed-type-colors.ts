/**
 * Teintes volontairement éloignées (pas de nuances de vert entre séries voisines).
 * Index 0 = bleu, 1 = orange, etc.
 */
export const FEED_TYPE_PALETTE = [
  "#2563EB",
  "#EA580C",
  "#7C3AED",
  "#DC2626",
  "#0891B2",
  "#DB2777",
  "#CA8A04",
  "#4F46E5",
  "#0D9488",
  "#64748B"
] as const;

export function feedTypeColorAtIndex(index: number): string {
  return FEED_TYPE_PALETTE[index % FEED_TYPE_PALETTE.length]!;
}
