import type { FarmPredictionsPayload } from "../../lib/api/predictions";

export function formatPredictionDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function formatGeneratedAt(iso: string | null, locale: string): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/** Prix/kg issu des prévisions — absent si la réponse IA est incomplète. */
export function getPredictionPricePerKg(
  payload: FarmPredictionsPayload
): number | undefined {
  const value = payload.sale_timing?.optimal_window?.expected_price_per_kg;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function confidenceLevel(
  value: number
): "high" | "medium" | "low" {
  if (value > 0.8) {
    return "high";
  }
  if (value >= 0.5) {
    return "medium";
  }
  return "low";
}
