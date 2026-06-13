import type { FinanceOverviewMonthPoint } from "../../lib/api";

function safeNum(raw: string | number): number {
  const n = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  return Number.isFinite(n) ? n : 0;
}

export function financeMonthRevenueSeries(
  months: FinanceOverviewMonthPoint[]
): number[] {
  return months.map((m) => safeNum(m.revenues));
}

export function financeMonthExpenseSeries(
  months: FinanceOverviewMonthPoint[]
): number[] {
  return months.map((m) => safeNum(m.expenses));
}

export function financeMonthNetSeries(
  months: FinanceOverviewMonthPoint[]
): number[] {
  return months.map((m) => safeNum(m.revenues) - safeNum(m.expenses));
}

/** Évolution du solde cumulé sur la fenêtre `months` (alignée sur balanceAllTime). */
export function financeCumulativeBalanceSeries(
  months: FinanceOverviewMonthPoint[],
  balanceAllTime: string | number
): number[] {
  const nets = financeMonthNetSeries(months);
  const end = safeNum(balanceAllTime);
  const sumWindow = nets.reduce((acc, n) => acc + n, 0);
  let cum = end - sumWindow;
  return nets.map((n) => {
    cum += n;
    return cum;
  });
}
