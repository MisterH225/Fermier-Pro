import { mobileColors } from "../../theme/mobileTheme";
import { feedSeriesColor } from "../charts/smartChartAdapters";

/** Jours de référence pour remplir la jauge à 100 %. */
export const FEED_GAUGE_REFERENCE_DAYS = 30;

/** Seuils visuels demandés (jours restants). */
export const FEED_GAUGE_CRITICAL_DAYS = 3;
export const FEED_GAUGE_WARNING_DAYS = 5;

export function feedStockGaugePercent(daysRemaining: number | null): number | null {
  if (daysRemaining == null || !Number.isFinite(daysRemaining)) {
    return null;
  }
  return Math.min(
    100,
    Math.max(0, Math.round((daysRemaining / FEED_GAUGE_REFERENCE_DAYS) * 100))
  );
}

export function feedStockGaugeColor(
  daysRemaining: number | null,
  seriesIndex: number
): string {
  if (daysRemaining == null) {
    return mobileColors.textSecondary;
  }
  if (daysRemaining <= FEED_GAUGE_CRITICAL_DAYS) {
    return mobileColors.error;
  }
  if (daysRemaining <= FEED_GAUGE_WARNING_DAYS) {
    return mobileColors.warning;
  }
  return feedSeriesColor(seriesIndex);
}
