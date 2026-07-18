/**
 * Calculs d'aperçu des frais plateforme (vendeur marketplace / véto).
 * Alignés sur les arrondis API (entier XOF marketplace, centimes véto).
 */

export type PlatformFeeBreakdown = {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  /** Pourcentage (ex. 1.5 pour 1,5 %) — une décimale, sans arrondi entier trompeur. */
  ratePct: number;
};

/** Convertit un taux (0.015) en % affichable (1.5), pas `Math.round(rate*100)` (= 2). */
export function rateToPercent(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) {
    return 0;
  }
  return Math.round(rate * 1000) / 10;
}

/** Libellé % pour l’UI (FR : virgule décimale). */
export function formatRatePercentLabel(ratePct: number): string {
  if (!Number.isFinite(ratePct)) {
    return "0";
  }
  if (Number.isInteger(ratePct)) {
    return String(ratePct);
  }
  return ratePct.toFixed(1).replace(".", ",");
}

/** Commission marketplace / boutique (entier, ex. XOF). */
export function computeSellerFeeBreakdown(
  grossAmount: number,
  sellerRate: number
): PlatformFeeBreakdown | null {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return null;
  }
  const rate = Number.isFinite(sellerRate) && sellerRate >= 0 ? sellerRate : 0;
  const roundedGross = Math.round(grossAmount);
  const feeAmount = Math.round(roundedGross * rate);
  return {
    grossAmount: roundedGross,
    feeAmount,
    netAmount: Math.max(0, roundedGross - feeAmount),
    ratePct: rateToPercent(rate)
  };
}

/** Commission prestation vétérinaire (arrondi centimes, comme l'API). */
export function computeVetFeeBreakdown(
  grossAmount: number,
  vetRate: number
): PlatformFeeBreakdown | null {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return null;
  }
  const rate = Number.isFinite(vetRate) && vetRate >= 0 ? vetRate : 0;
  const feeAmount = Math.round(grossAmount * rate * 100) / 100;
  const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;
  return {
    grossAmount,
    feeAmount,
    netAmount: Math.max(0, netAmount),
    ratePct: rateToPercent(rate)
  };
}

export function parsePriceInput(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}
