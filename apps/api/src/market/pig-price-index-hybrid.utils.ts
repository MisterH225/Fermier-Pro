/** Point de données pour l'indice hybride (prix/kg + poids effectif). */
export type HybridIndexPoint = {
  pricePerKg: number;
  volumeKg: number;
  /** Poids source : 1.0 transaction confirmée, 0.3 annonce active. */
  sourceWeight: number;
  kind: "confirmed" | "listing";
  listingId?: string;
  sellerUserId?: string;
};

export const HYBRID_INDEX_RULES = {
  confirmedWeight: 1.0,
  activeListingWeight: 0.3,
  minAccountAgeDays: 30,
  minCompletedTransactions: 2,
  minSellerIndexWeight: 0.5,
  maxPriceDeviationPct: 30,
  winsorizationLowerPct: 5,
  winsorizationUpperPct: 95,
  circuitBreakerDailyPct: 15,
  lookbackDays: 30,
  newAccountIndexWeight: 0.1
} as const;

export function accountAgeDays(createdAt: Date, now = new Date()): number {
  const ms = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Poids indice vendeur selon ancienneté et transactions. */
export function resolveSellerIndexWeight(
  createdAt: Date,
  completedTransactions: number,
  storedWeight: number
): number {
  const age = accountAgeDays(createdAt);
  if (
    age >= HYBRID_INDEX_RULES.minAccountAgeDays &&
    completedTransactions >= HYBRID_INDEX_RULES.minCompletedTransactions
  ) {
    return Math.max(storedWeight, HYBRID_INDEX_RULES.minSellerIndexWeight);
  }
  return HYBRID_INDEX_RULES.newAccountIndexWeight;
}

export function isListingEligibleForIndex(
  createdAt: Date,
  completedTransactions: number,
  indexWeight: number
): boolean {
  const weight = resolveSellerIndexWeight(
    createdAt,
    completedTransactions,
    indexWeight
  );
  return (
    weight >= HYBRID_INDEX_RULES.minSellerIndexWeight &&
    accountAgeDays(createdAt) >= HYBRID_INDEX_RULES.minAccountAgeDays &&
    completedTransactions >= HYBRID_INDEX_RULES.minCompletedTransactions
  );
}

export function winsorizePoints(points: HybridIndexPoint[]): HybridIndexPoint[] {
  if (points.length < 4) {
    return points;
  }
  const sorted = [...points].sort((a, b) => a.pricePerKg - b.pricePerKg);
  const lowerIdx = Math.floor(
    (HYBRID_INDEX_RULES.winsorizationLowerPct / 100) * sorted.length
  );
  const upperIdx = Math.min(
    sorted.length - 1,
    Math.ceil((HYBRID_INDEX_RULES.winsorizationUpperPct / 100) * sorted.length) -
      1
  );
  const lowerBound = sorted[lowerIdx]!.pricePerKg;
  const upperBound = sorted[upperIdx]!.pricePerKg;
  return points.map((p) => ({
    ...p,
    pricePerKg: Math.min(upperBound, Math.max(lowerBound, p.pricePerKg))
  }));
}

/** Médiane pondérée : poids effectif = sourceWeight × volumeKg. */
export function weightedMedian(points: HybridIndexPoint[]): number | null {
  const weighted = points
    .map((p) => ({
      price: p.pricePerKg,
      w: p.sourceWeight * p.volumeKg
    }))
    .filter((p) => p.w > 0 && Number.isFinite(p.price));
  if (weighted.length === 0) {
    return null;
  }
  const sorted = weighted.sort((a, b) => a.price - b.price);
  const total = sorted.reduce((s, p) => s + p.w, 0);
  const half = total / 2;
  let cum = 0;
  for (const p of sorted) {
    cum += p.w;
    if (cum >= half) {
      return p.price;
    }
  }
  return sorted[sorted.length - 1]!.price;
}

export function priceDeviationPct(
  price: number,
  reference: number | null
): number | null {
  if (reference == null || reference <= 0 || !Number.isFinite(price)) {
    return null;
  }
  return (Math.abs(price - reference) / reference) * 100;
}

export type HybridIndexTrend = "up" | "down" | "stable";

export function computeTrend(
  current: number,
  previous: number | null,
  thresholdPct = 0.5
): HybridIndexTrend {
  if (previous == null || previous <= 0) {
    return "stable";
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < thresholdPct) {
    return "stable";
  }
  return pct > 0 ? "up" : "down";
}

export function variationPct(current: number, previous: number | null): number | null {
  if (previous == null || previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}
