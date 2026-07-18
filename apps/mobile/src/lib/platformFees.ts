/**
 * Calculs d'aperçu des frais plateforme (vendeur marketplace / véto).
 * Alignés sur les arrondis API (entier XOF marketplace, centimes véto).
 */

export type PlatformFeeBreakdown = {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  ratePct: number;
};

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
    ratePct: Math.round(rate * 100)
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
    ratePct: Math.round(rate * 100)
  };
}

export function parsePriceInput(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}
