import type { TFunction } from "i18next";
import type { FarmFeedStatItemDto, DashboardFeedStockItemDto } from "../../lib/api";
import { feedSeriesColor } from "../charts/smartChartAdapters";
import {
  feedStockGaugeColor,
  feedStockGaugePercent,
  type FeedStockGaugeStatus
} from "./feedStockGaugeUtils";

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
  /** Libellé jours — toujours affiché en gris (informatif). */
  daysLabel?: string;
  /** Dernier contrôle — orange si > 7 jours. */
  lastCheckWarning?: boolean;
  insufficientData?: boolean;
};

function resolveStatus(stat: FarmFeedStatItemDto): FeedStockGaugeStatus {
  if (stat.stockStatus) {
    return stat.stockStatus;
  }
  if (stat.hasSufficientData === false) {
    return "no_data";
  }
  if (stat.status === "critical") return "critical";
  if (stat.status === "warning") return "warning";
  return "ok";
}

function formatDaysRemaining(
  days: number | null,
  hasSufficientData: boolean,
  t: TFunction
): string {
  if (!hasSufficientData) {
    return t("feedStock.gaugeInsufficientData");
  }
  if (days == null) {
    return t("feedStock.gaugeUnknownDays");
  }
  return t("feedStock.gaugeDaysEstimate", { count: days });
}

export function feedStatEligibleForGauge(
  stat: Pick<
    FarmFeedStatItemDto,
    "lastCheckDate" | "currentStockKg" | "hasSufficientData" | "stockAtLastEntry"
  >
): boolean {
  if (stat.lastCheckDate) {
    return true;
  }
  if (stat.stockAtLastEntry && Number.parseFloat(stat.stockAtLastEntry) > 0) {
    return true;
  }
  const stockKg = Number.parseFloat(stat.currentStockKg);
  if (Number.isFinite(stockKg) && stockKg > 0) {
    return true;
  }
  return stat.hasSufficientData === true;
}

export function dashboardFeedItemEligibleForGauge(
  item: Pick<
    DashboardFeedStockItemDto,
    "remainingKg" | "daysRemaining" | "percentRemaining" | "stockStatus"
  >
): boolean {
  const stockKg = Number.parseFloat(item.remainingKg);
  if (Number.isFinite(stockKg) && stockKg > 0) {
    return true;
  }
  if (item.daysRemaining != null) {
    return true;
  }
  if (item.percentRemaining != null) {
    return true;
  }
  return item.stockStatus != null && item.stockStatus !== "no_data";
}

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
  const percentRemaining = stat.percentRemaining ?? null;
  const percent = feedStockGaugePercent(percentRemaining);
  const stockStatus = resolveStatus(stat);
  const gaugeColor = feedStockGaugeColor(stockStatus, stat.stockStatusColor);
  const dotColor = feedSeriesColor(index);
  const hasData = stat.hasSufficientData !== false;

  const stockLabel = `${t("feedStock.current")}: ${formatMassKg(stockKg)}`;
  const dailyLabel =
    daily != null && hasData
      ? t("feedStock.avgDaily", {
          kg: daily.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
        })
      : t("feedStock.gaugeNoDaily");

  const daysLabel = formatDaysRemaining(days, hasData, t);

  const lastCheckDays = stat.daysSinceLastCheck ?? null;
  const lastCheckLine =
    lastCheckDays != null
      ? t("feedStock.lastCheckAgo", { count: lastCheckDays })
      : null;

  const subtitleParts = [stockLabel, dailyLabel];
  if (lastCheckLine) {
    subtitleParts.push(lastCheckLine);
  }

  const percentLabel =
    percent != null
      ? t("feedStock.gaugePercentRemaining", { value: percent })
      : "—";

  return {
    key: stat.feedTypeId,
    name: stat.name,
    subtitle: subtitleParts.join(" · "),
    displayValue: percentLabel,
    percent,
    gaugeColor,
    dotColor,
    daysLabel,
    lastCheckWarning: lastCheckDays != null && lastCheckDays > 7,
    insufficientData: !hasData
  };
}

export function dashboardFeedItemToGauge(
  item: DashboardFeedStockItemDto,
  index: number,
  t: TFunction,
  locale: string
): FeedStockGaugeViewModel {
  const days = item.daysRemaining ?? null;
  const percentRemaining =
    item.percentRemaining ??
    (item.ratio != null ? Math.round(item.ratio * 100) : null);
  const percent = feedStockGaugePercent(percentRemaining);
  const stockStatus: FeedStockGaugeStatus =
    item.stockStatus ??
    (item.level === "critical"
      ? "critical"
      : item.level === "medium"
        ? "warning"
        : percent == null
          ? "no_data"
          : "ok");
  const gaugeColor = feedStockGaugeColor(stockStatus, item.color);
  const dotColor = item.color ?? feedSeriesColor(index);
  const stockKg = Number.parseFloat(item.remainingKg);
  const hasData = percent != null || days != null;

  const daysLabel = formatDaysRemaining(days, hasData, t);

  return {
    key: item.productName,
    name: item.productName,
    subtitle: t("feedStock.gaugeDashboardSubtitle", {
      kg: stockKg.toLocaleString(locale, { maximumFractionDigits: 1 }),
      count: days ?? "—"
    }),
    displayValue:
      percent != null
        ? t("feedStock.gaugePercentRemaining", { value: percent })
        : "—",
    percent,
    gaugeColor,
    dotColor,
    daysLabel
  };
}
