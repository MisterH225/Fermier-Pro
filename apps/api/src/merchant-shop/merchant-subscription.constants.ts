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

export function startOfUtcHour(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours()
    )
  );
}

/** Clé de période facture / rappel — heure exacte si billing horaire. */
export function billingPeriodStart(
  date: Date,
  unit: MerchantPremiumBillingUnit
): Date {
  return unit === "hour" ? startOfUtcHour(date) : startOfUtcDay(date);
}

export function billingReminderKey(
  billingAt: Date,
  stage: string,
  unit: MerchantPremiumBillingUnit
): string {
  const stamp =
    unit === "hour"
      ? billingPeriodStart(billingAt, unit).toISOString()
      : billingPeriodStart(billingAt, unit).toISOString().slice(0, 10);
  return `${stamp}:${stage}`;
}

export function daysBetweenUtc(a: Date, b: Date): number {
  const ms = startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Nombre de périodes de facturation entre deux dates (arrondi). */
export function periodsBetweenUtc(
  from: Date,
  to: Date,
  unit: MerchantPremiumBillingUnit,
  interval = 1
): number {
  const n = Math.max(1, Math.floor(interval));
  if (unit === "hour") {
    return Math.round(
      (startOfUtcHour(to).getTime() - startOfUtcHour(from).getTime()) /
        (n * 3_600_000)
    );
  }
  if (unit === "day") {
    return Math.round(daysBetweenUtc(from, to) / n);
  }
  // month — approximation calendaire via jours / 30
  return Math.round(daysBetweenUtc(from, to) / (n * 30));
}

/** Pour month/day : jours calendaires. Pour hour : `graceDays` = heures de grâce. */
export function graceDurationMs(
  graceUnits: number,
  unit: MerchantPremiumBillingUnit
): number {
  const n = Math.max(0, Math.floor(graceUnits));
  if (unit === "hour") {
    return n * 3_600_000;
  }
  return n * 86_400_000;
}

export function applyPromoPercent(fullPrice: number, percentOff: number): number {
  const pct = Math.min(100, Math.max(0, Math.floor(percentOff)));
  if (pct <= 0) {
    return Math.round(fullPrice);
  }
  return Math.max(0, Math.round(fullPrice * (1 - pct / 100)));
}
