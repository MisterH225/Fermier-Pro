import { mobileColors } from "./mobileTheme";

/** Couleur « en attente » (marketplace finance, badges). */
export const chartPendingColor = "#D97706";

/**
 * Teintes volontairement éloignées pour séries multi-lignes (alimentation, etc.).
 * Alignée sur `apps/api/src/feed-stock/feed-type-colors.ts`.
 */
export const feedSeriesPalette = [
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

export function feedSeriesColor(seriesIndex: number): string {
  return feedSeriesPalette[seriesIndex % feedSeriesPalette.length]!;
}

export const chartSemanticColors = {
  revenue: mobileColors.success,
  expense: mobileColors.error,
  budget: mobileColors.accent,
  pending: chartPendingColor
} as const;
