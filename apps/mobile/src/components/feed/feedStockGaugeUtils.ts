/** Statut calcul stock (aligné API). */
export type FeedStockGaugeStatus = "ok" | "warning" | "critical" | "no_data";

/** Couleurs jauge selon criticité stock. */
export const FEED_GAUGE_STATUS_COLORS: Record<FeedStockGaugeStatus, string> = {
  ok: "#1D9E75",
  warning: "#BA7517",
  critical: "#E24B4A",
  no_data: "#B4B2A9"
};

/** Remplissage jauge = % restant depuis la dernière entrée. */
export function feedStockGaugePercent(
  percentRemaining: number | null
): number | null {
  if (percentRemaining == null || !Number.isFinite(percentRemaining)) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round(percentRemaining)));
}

export function feedStockGaugeColor(
  stockStatus: FeedStockGaugeStatus | null | undefined,
  stockStatusColor?: string | null
): string {
  if (stockStatusColor?.trim()) {
    return stockStatusColor;
  }
  if (stockStatus && stockStatus in FEED_GAUGE_STATUS_COLORS) {
    return FEED_GAUGE_STATUS_COLORS[stockStatus];
  }
  return FEED_GAUGE_STATUS_COLORS.no_data;
}
