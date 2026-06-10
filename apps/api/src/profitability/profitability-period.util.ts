import type { ProfitabilityPeriodKey } from "./profitability.types";

export type PeriodBounds = {
  start: Date;
  end: Date;
};

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfNextUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function startOfUtcQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
}

function startOfNextUtcQuarter(d: Date): Date {
  const start = startOfUtcQuarter(d);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
}

function startOfUtcYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function startOfNextUtcYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
}

export function resolvePeriodBounds(
  period: ProfitabilityPeriodKey,
  custom?: { start: string; end: string }
): PeriodBounds {
  const now = new Date();
  switch (period) {
    case "current_month":
      return { start: startOfUtcMonth(now), end: startOfNextUtcMonth(now) };
    case "current_quarter":
      return { start: startOfUtcQuarter(now), end: startOfNextUtcQuarter(now) };
    case "current_year":
      return { start: startOfUtcYear(now), end: startOfNextUtcYear(now) };
    case "all_time":
      return {
        start: new Date(Date.UTC(2000, 0, 1)),
        end: startOfNextUtcMonth(now)
      };
    case "custom": {
      if (!custom?.start || !custom?.end) {
        throw new Error("Période personnalisée : start et end requis");
      }
      return {
        start: new Date(custom.start),
        end: new Date(custom.end)
      };
    }
    default:
      return { start: startOfUtcMonth(now), end: startOfNextUtcMonth(now) };
  }
}

export function previousPeriodBounds(bounds: PeriodBounds): PeriodBounds {
  const durationMs = bounds.end.getTime() - bounds.start.getTime();
  return {
    start: new Date(bounds.start.getTime() - durationMs),
    end: new Date(bounds.start.getTime())
  };
}

export function pct(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
    return null;
  }
  return (n / d) * 100;
}

export function safeDiv(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
    return null;
  }
  return n / d;
}

export function dec(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : 0;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return 0;
}
