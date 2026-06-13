import {
  chartSemanticColors,
  feedSeriesColor
} from "../../theme/chartPalette";
import { mobileColors } from "../../theme/mobileTheme";
import type { FarmFeedChartDto } from "../../lib/api";
import type { SmartChartLine, SmartChartPeriod } from "./SmartChart";

export type FinanceMonthPoint = {
  month: string;
  revenues?: number;
  expenses?: number;
  net?: number;
};

export type MarketplaceFinanceMonthPoint = {
  month: string;
  confirmedRevenue?: number;
  pendingRevenue?: number;
  confirmedSpent?: number;
  blockedFunds?: number;
};

export function marketplaceSellerFinanceLines(
  months: MarketplaceFinanceMonthPoint[],
  confirmedLabel: string,
  pendingLabel: string
): SmartChartLine[] {
  return [
    {
      key: "confirmedRevenue",
      label: confirmedLabel,
      color: mobileColors.success,
      data: months.map((m) => ({
        month: m.month,
        value: Number(m.confirmedRevenue ?? 0)
      }))
    },
    {
      key: "pendingRevenue",
      label: pendingLabel,
      color: chartSemanticColors.pending,
      data: months.map((m) => ({
        month: m.month,
        value: Number(m.pendingRevenue ?? 0)
      }))
    }
  ];
}

export function marketplaceBuyerFinanceLines(
  months: MarketplaceFinanceMonthPoint[],
  confirmedLabel: string,
  pendingLabel: string
): SmartChartLine[] {
  return [
    {
      key: "confirmedSpent",
      label: confirmedLabel,
      color: mobileColors.success,
      data: months.map((m) => ({
        month: m.month,
        value: Number(m.confirmedSpent ?? 0)
      }))
    },
    {
      key: "blockedFunds",
      label: pendingLabel,
      color: chartSemanticColors.pending,
      data: months.map((m) => ({
        month: m.month,
        value: Number(m.blockedFunds ?? 0)
      }))
    }
  ];
}

export function financeMonthsToRevExpLines(
  months: FinanceMonthPoint[],
  revenueLabel: string,
  expenseLabel: string
): SmartChartLine[] {
  return [
    {
      key: "revenues",
      label: revenueLabel,
      color: mobileColors.success,
      data: months.map((m) => ({
        month: m.month,
        value: Number(m.revenues ?? 0)
      }))
    },
    {
      key: "expenses",
      label: expenseLabel,
      color: mobileColors.error,
      data: months.map((m) => ({
        month: m.month,
        value: Number(m.expenses ?? 0)
      }))
    }
  ];
}

export function financeMonthsToSingleLine(
  months: FinanceMonthPoint[],
  key: string,
  label: string,
  color: string,
  pick: (m: FinanceMonthPoint) => number
): SmartChartLine[] {
  return [
    {
      key,
      label,
      color,
      data: months.map((m) => ({
        month: m.month,
        value: pick(m)
      }))
    }
  ];
}

export type BudgetVsExpenseMonth = {
  month: string;
  expenses: number;
  /** Budget planifié du mois (`FarmBudget`), sinon repli sur `fallbackBudget`. */
  budget?: number;
};

export function budgetVsExpenseLines(
  months: BudgetVsExpenseMonth[],
  fallbackBudget: number,
  expenseLabel: string,
  budgetLabel: string
): SmartChartLine[] {
  return [
    {
      key: "expenses",
      label: expenseLabel,
      color: mobileColors.error,
      data: months.map((m) => ({
        month: m.month,
        value: m.expenses
      }))
    },
    {
      key: "budget",
      label: budgetLabel,
      color: mobileColors.accent,
      data: months.map((m) => ({
        month: m.month,
        value:
          m.budget != null && Number.isFinite(m.budget) && m.budget > 0
            ? m.budget
            : fallbackBudget
      }))
    }
  ];
}

export function barDataToLine(
  data: { label: string; value: number; color?: string }[],
  monthKeys?: string[]
): SmartChartLine[] {
  return [
    {
      key: "series",
      label: "",
      color: data[0]?.color ?? mobileColors.accent,
      data: data.map((d, i) => ({
        month: monthKeys?.[i] ?? d.label,
        value: d.value
      }))
    }
  ];
}

export { feedSeriesColor, feedSeriesPalette } from "../../theme/chartPalette";

export function feedChartToLines(chart: FarmFeedChartDto): SmartChartLine[] {
  const series = chart.series ?? [];
  const weekKeys = chart.weekKeys ?? [];
  return series.map((s, i) => ({
    key: s.feedTypeId ?? `series-${i}`,
    label: s.name ?? "—",
    color: feedSeriesColor(i),
    data: weekKeys.map((week, wi) => ({
      month: week,
      value: s.points?.[wi] ?? 0
    }))
  }));
}

export function feedPeriodToChartPeriod(p: "3m" | "6m" | "12m"): SmartChartPeriod {
  if (p === "3m") return "3M";
  if (p === "12m") return "12M";
  return "6M";
}

export function chartPeriodToFeedPeriod(p: SmartChartPeriod): "3m" | "6m" | "12m" {
  if (p === "3M") return "3m";
  if (p === "12M") return "12m";
  return "6m";
}
