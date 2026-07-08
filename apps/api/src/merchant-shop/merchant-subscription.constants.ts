export const MERCHANT_SUBSCRIPTION_GRACE_DAYS = 7;

export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
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
