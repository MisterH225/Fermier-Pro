export type BuyerAnimalWeightRow = {
  animalId: string;
  weightKg: number;
  photoUrl?: string | null;
};

export type WeightArbitrationThresholds = {
  /** Écart total (kg) en dessous duquel on accepte automatiquement. */
  minDiffKg: number;
  /** Écart total (kg) minimal pour demander un arbitrage sur un lot multi-animaux. */
  cumulativeMinDiffKg: number;
};

export const DEFAULT_WEIGHT_ARBITRATION_MIN_DIFF_KG = 1;
export const DEFAULT_WEIGHT_ARBITRATION_CUMULATIVE_MIN_DIFF_KG = 5;

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

export function isWithinWeightTolerance(
  diffKg: number,
  thresholds: WeightArbitrationThresholds
): boolean {
  return diffKg < thresholds.minDiffKg;
}

/**
 * Arbitrage manuel autorisé si l'écart dépasse la tolérance
 * et, pour les lots multi-animaux, le seuil cumulé configuré.
 */
export function canRequestWeightArbitration(
  diffKg: number,
  animalCount: number,
  thresholds: WeightArbitrationThresholds
): boolean {
  if (diffKg < thresholds.minDiffKg) {
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
  } | null
): WeightArbitrationThresholds {
  const minRaw = Number(row?.marketplaceWeightArbitrationMinDiffKg);
  const cumRaw = Number(row?.marketplaceWeightArbitrationCumulativeMinDiffKg);
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
  return { minDiffKg, cumulativeMinDiffKg };
}
