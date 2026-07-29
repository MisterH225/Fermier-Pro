/**
 * Agrégations dashboard acheteur (périodes calendaires, sans nouvelle table).
 * Bornes exclusives en `end` pour requêtes `gte` / `lt`.
 */

export type BuyerDashboardPeriodKey = "month" | "quarter" | "year";

export type PeriodWindow = {
  start: Date;
  end: Date;
};

export type PeriodPair = {
  current: PeriodWindow;
  previous: PeriodWindow;
};

export type PeriodTotals = {
  total: number;
  previousTotal: number;
  count: number;
  previousCount: number;
  /** Variation % vs période précédente ; null si pas de base comparable. */
  deltaPct: number | null;
};

export function periodPairsAt(now = new Date()): Record<
  BuyerDashboardPeriodKey,
  PeriodPair
> {
  const y = now.getFullYear();
  const m = now.getMonth();
  const end = now;

  const monthStart = new Date(y, m, 1);
  const prevMonthStart = new Date(y, m - 1, 1);

  const q = Math.floor(m / 3);
  const quarterStart = new Date(y, q * 3, 1);
  const prevQuarterStart = new Date(y, q * 3 - 3, 1);

  const yearStart = new Date(y, 0, 1);
  const prevYearStart = new Date(y - 1, 0, 1);

  return {
    month: {
      current: { start: monthStart, end },
      previous: { start: prevMonthStart, end: monthStart }
    },
    quarter: {
      current: { start: quarterStart, end },
      previous: { start: prevQuarterStart, end: quarterStart }
    },
    year: {
      current: { start: yearStart, end },
      previous: { start: prevYearStart, end: yearStart }
    }
  };
}

export function decimalToNumber(
  value: { toNumber(): number } | number | null | undefined
): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = value.toNumber();
  return Number.isFinite(n) ? n : 0;
}

export function computeDeltaPct(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function emptyPeriodTotals(): PeriodTotals {
  return {
    total: 0,
    previousTotal: 0,
    count: 0,
    previousCount: 0,
    deltaPct: 0
  };
}

export function buildPeriodTotals(
  currentTotal: number,
  previousTotal: number,
  currentCount: number,
  previousCount: number
): PeriodTotals {
  return {
    total: currentTotal,
    previousTotal,
    count: currentCount,
    previousCount,
    deltaPct: computeDeltaPct(currentTotal, previousTotal)
  };
}

export type ProposalBucket = { count: number; amount: number };

export function emptyProposalBucket(): ProposalBucket {
  return { count: 0, amount: 0 };
}
