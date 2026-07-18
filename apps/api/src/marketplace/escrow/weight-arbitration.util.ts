/**
 * Tolérance de pesée marketplace.
 *
 * Règle combinée (P-36) : écart accepté si
 *   |poidsAcheteur − poidsVendeur| ≤ max(tolerancePercent% × poidsAcheteur, minDiffKg)
 *
 * Pourquoi max(% , kg) : une balance a une erreur absolue ET relative —
 * 1 kg sur un porcelet de 15 kg = 7 % (le kg seul est trop permissif),
 * 1 kg sur un porc de 120 kg = 0,8 % (le % seul serait trop strict en bas de gamme).
 *
 * Non rétroactif : seules les nouvelles contre-déclarations vendeur post-déploiement
 * appliquent moyenne + seuil combiné. Les transactions déjà en WEIGHT_COUNTER_DECLARED
 * / WEIGHT_DISPUTED restent sur le flux précédent.
 */

export type BuyerAnimalWeightRow = {
  animalId: string;
  weightKg: number;
  photoUrl?: string | null;
};

export type WeightArbitrationThresholds = {
  /** Écart total (kg) plancher sous lequel on accepte automatiquement. */
  minDiffKg: number;
  /** Écart total (kg) minimal pour demander un arbitrage sur un lot multi-animaux. */
  cumulativeMinDiffKg: number;
  /**
   * Tolérance relative (%) — défaut 3 : écart normal entre deux balances de terrain.
   * Combinée avec minDiffKg via max().
   */
  tolerancePercent: number;
};

export const DEFAULT_WEIGHT_ARBITRATION_MIN_DIFF_KG = 1;
export const DEFAULT_WEIGHT_ARBITRATION_CUMULATIVE_MIN_DIFF_KG = 5;
/** Écart relatif typique entre deux balances de terrain (~3 %). */
export const DEFAULT_WEIGHT_TOLERANCE_PERCENT = 3;

export function parseBuyerAnimalWeights(
  raw: unknown
): BuyerAnimalWeightRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((row): BuyerAnimalWeightRow | null => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const animalId =
        typeof (row as BuyerAnimalWeightRow).animalId === "string"
          ? (row as BuyerAnimalWeightRow).animalId.trim()
          : "";
      const weightKg = Number((row as BuyerAnimalWeightRow).weightKg);
      if (!animalId || !Number.isFinite(weightKg) || weightKg <= 0) {
        return null;
      }
      const photoUrl =
        typeof (row as BuyerAnimalWeightRow).photoUrl === "string"
          ? (row as BuyerAnimalWeightRow).photoUrl?.trim() || null
          : null;
      return { animalId, weightKg, photoUrl };
    })
    .filter((row): row is BuyerAnimalWeightRow => row != null);
}

export function sumAnimalWeights(
  rows: { weightKg: number }[]
): number {
  return rows.reduce((acc, row) => acc + row.weightKg, 0);
}

export function resolveDeclaredBuyerWeightKg(params: {
  animalWeights?: BuyerAnimalWeightRow[];
  realWeightKg?: number | null;
}): number | null {
  if (params.animalWeights?.length) {
    const sum = sumAnimalWeights(params.animalWeights);
    if (sum > 0 && Number.isFinite(sum)) {
      return sum;
    }
  }
  if (
    params.realWeightKg != null &&
    Number.isFinite(params.realWeightKg) &&
    params.realWeightKg > 0
  ) {
    return params.realWeightKg;
  }
  return null;
}

export function computeWeightDifferenceKg(
  buyerKg: number,
  sellerKg: number
): number {
  return Math.abs(buyerKg - sellerKg);
}

/** Tolérance effective en kg = max(% × acheteur, plancher kg). */
export function effectiveWeightToleranceKg(
  buyerKg: number,
  thresholds: WeightArbitrationThresholds
): number {
  if (!(buyerKg > 0)) {
    return thresholds.minDiffKg;
  }
  const pctTol = (thresholds.tolerancePercent / 100) * buyerKg;
  const effective = Math.max(pctTol, thresholds.minDiffKg);
  return Math.round(effective * 10_000) / 10_000;
}

/**
 * Auto-validation si l'écart ≤ tolérance effective.
 * Poids acheteur nul/absent → false (pas d'auto-validation).
 */
export function isWithinWeightTolerance(
  buyerKg: number,
  sellerKg: number,
  thresholds: WeightArbitrationThresholds
): boolean {
  if (!(buyerKg > 0) || !(sellerKg > 0)) {
    return false;
  }
  const diff = computeWeightDifferenceKg(buyerKg, sellerKg);
  return diff <= effectiveWeightToleranceKg(buyerKg, thresholds);
}

/**
 * Moyenne des deux pesées, arrondie à 4 décimales (précision Decimal du champ).
 */
export function averageRetainedWeightKg(
  buyerKg: number,
  sellerKg: number
): number {
  const avg = (buyerKg + sellerKg) / 2;
  return Math.round(avg * 10_000) / 10_000;
}

/**
 * Arbitrage manuel autorisé si l'écart dépasse la tolérance effective
 * et, pour les lots multi-animaux, le seuil cumulé configuré.
 */
export function canRequestWeightArbitration(
  diffKg: number,
  animalCount: number,
  thresholds: WeightArbitrationThresholds,
  buyerKg?: number
): boolean {
  const floor =
    buyerKg != null && buyerKg > 0
      ? effectiveWeightToleranceKg(buyerKg, thresholds)
      : thresholds.minDiffKg;
  if (diffKg <= floor) {
    return false;
  }
  if (animalCount <= 1) {
    return true;
  }
  return diffKg >= thresholds.cumulativeMinDiffKg;
}

export function normalizeWeightArbitrationThresholds(
  row?: {
    marketplaceWeightArbitrationMinDiffKg?: unknown;
    marketplaceWeightArbitrationCumulativeMinDiffKg?: unknown;
    marketplaceWeightTolerancePercent?: unknown;
  } | null
): WeightArbitrationThresholds {
  const minRaw = Number(row?.marketplaceWeightArbitrationMinDiffKg);
  const cumRaw = Number(row?.marketplaceWeightArbitrationCumulativeMinDiffKg);
  const pctRaw = Number(row?.marketplaceWeightTolerancePercent);
  const minDiffKg =
    Number.isFinite(minRaw) && minRaw >= 0
      ? minRaw
      : DEFAULT_WEIGHT_ARBITRATION_MIN_DIFF_KG;
  const cumulativeMinDiffKg =
    Number.isFinite(cumRaw) && cumRaw >= minDiffKg
      ? cumRaw
      : Math.max(
          DEFAULT_WEIGHT_ARBITRATION_CUMULATIVE_MIN_DIFF_KG,
          minDiffKg
        );
  const tolerancePercent =
    Number.isFinite(pctRaw) && pctRaw >= 0 && pctRaw <= 100
      ? pctRaw
      : DEFAULT_WEIGHT_TOLERANCE_PERCENT;
  return { minDiffKg, cumulativeMinDiffKg, tolerancePercent };
}
