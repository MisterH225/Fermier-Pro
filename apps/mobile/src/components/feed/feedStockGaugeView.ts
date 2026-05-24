import type { TFunction } from "i18next";
import type { FarmFeedStatItemDto, DashboardFeedStockItemDto } from "../../lib/api";
import {
  feedStockGaugeColor,
  feedStockGaugePercent
} from "./feedStockGaugeUtils";
import { feedSeriesColor } from "../charts/smartChartAdapters";

function formatMassKg(kg: number): string {
  if (!Number.isFinite(kg)) return "—";
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} t`;
  }
  return `${kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;
}

export type FeedStockGaugeViewModel = {
  key: string;
  name: string;
  subtitle: string;
  displayValue: string;
  percent: number | null;
  gaugeColor: string;
  dotColor: string;
  centerLabel?: string;
};

export function farmFeedStatToGauge(
  stat: FarmFeedStatItemDto,
  index: number,
  t: TFunction
): FeedStockGaugeViewModel {
  const stockKg = Number.parseFloat(stat.currentStockKg);
  const daily = stat.avgDailyConsumptionKg
    ? Number.parseFloat(stat.avgDailyConsumptionKg)
    : null;
  const days = stat.daysRemaining;
  const percent = feedStockGaugePercent(days);
  const gaugeColor = feedStockGaugeColor(days, index);
  const dotColor = feedSeriesColor(index);

  const stockLabel = formatMassKg(stockKg);
  const dailyLabel =
    daily != null
      ? t("feedStock.gaugeDaily", {
          kg: daily.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
        })
      : t("feedStock.gaugeNoDaily");

  const daysSubtitle =
    days != null
      ? t("feedStock.gaugeDaysLeft", { count: days })
      : t("feedStock.gaugeUnknownDays");

  return {
    key: stat.feedTypeId,
    name: stat.name,
    subtitle: `${stockLabel} · ${dailyLabel} · ${daysSubtitle}`,
    displayValue:
      percent != null ? t("feedStock.gaugePercent", { value: percent }) : "—",
    percent,
    gaugeColor,
    dotColor,
    centerLabel:
      days != null ? t("feedStock.gaugeCenterDays", { count: days }) : undefined
  };
}

export function dashboardFeedItemToGauge(
  item: DashboardFeedStockItemDto,
  index: number,
  t: TFunction,
  locale: string
): FeedStockGaugeViewModel {
  const days = item.daysRemaining ?? null;
  const percent = feedStockGaugePercent(days);
  const gaugeColor = feedStockGaugeColor(days, index);
  const dotColor = item.color ?? feedSeriesColor(index);
  const stockKg = Number.parseFloat(item.remainingKg);

  return {
    key: item.productName,
    name: item.productName,
    subtitle:
      days != null
        ? t("feedStock.gaugeDashboardSubtitle", {
            kg: stockKg.toLocaleString(locale, { maximumFractionDigits: 1 }),
            count: days
          })
        : t("feedStock.gaugeDashboardNoDays", {
            kg: stockKg.toLocaleString(locale, { maximumFractionDigits: 1 })
          }),
    displayValue:
      percent != null ? t("feedStock.gaugePercent", { value: percent }) : "—",
    percent,
    gaugeColor,
    dotColor,
    centerLabel:
      days != null ? t("feedStock.gaugeCenterDays", { count: days }) : undefined
  };
}
