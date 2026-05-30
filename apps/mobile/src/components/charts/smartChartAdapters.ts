import { mobileColors } from "../../theme/mobileTheme";
import type { FarmFeedChartDto } from "../../lib/api";
import type { SmartChartLine, SmartChartPeriod } from "./SmartChart";

export type FinanceMonthPoint = {
  month: string;
  revenues?: number;
  expenses?: number;
  net?: number;
};

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

/**
 * Teintes volontairement éloignées (bleu, orange, violet… — pas deux verts).
 * Alignée sur `apps/api/src/feed-stock/feed-type-colors.ts`.
 */
export const FEED_SERIES_PALETTE = [
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
  return FEED_SERIES_PALETTE[seriesIndex % FEED_SERIES_PALETTE.length]!;
}

export function feedChartToLines(chart: FarmFeedChartDto): SmartChartLine[] {
  return chart.series.map((s, i) => ({
    key: s.feedTypeId,
    label: s.name,
    color: feedSeriesColor(i),
    data: chart.weekKeys.map((week, wi) => ({
      month: week,
      value: s.points[wi] ?? 0
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
