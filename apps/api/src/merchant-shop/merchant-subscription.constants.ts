export type MerchantPremiumBillingUnit = "hour" | "day" | "month";

/** Défaut historique — utiliséé si settings absents. */
export const MERCHANT_SUBSCRIPTION_GRACE_DAYS = 7;

export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function addHoursUtc(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addBillingPeriod(
  from: Date,
  unit: MerchantPremiumBillingUnit,
  interval = 1
): Date {
  const n = Math.max(1, Math.floor(interval));
  if (unit === "hour") {
    return addHoursUtc(from, n);
  }
  if (unit === "day") {
    return addDaysUtc(from, n);
  }
  return addMonthsUtc(from, n);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export function daysBetweenUtc(a: Date, b: Date): number {
  const ms = startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function applyPromoPercent(fullPrice: number, percentOff: number): number {
  const pct = Math.min(100, Math.max(0, Math.floor(percentOff)));
  if (pct <= 0) {
    return Math.round(fullPrice);
  }
  return Math.max(0, Math.round(fullPrice * (1 - pct / 100)));
}
