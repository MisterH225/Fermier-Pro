export type WeightPoint = {
  weightKg: number;
  measuredAt: Date;
};

export type WeightSource = "weigh" | "pen_avg" | "entry" | "estimated";

export function decimalToNum(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (typeof v === "number") {
    return v;
  }
  if (typeof v === "string") {
    return Number.parseFloat(v) || 0;
  }
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

/** GMQ en g/jour entre deux pesées. */
export function gmqBetween(
  prevKg: number,
  nextKg: number,
  prevAt: Date,
  nextAt: Date
): number | null {
  const days =
    (nextAt.getTime() - prevAt.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 0) {
    return null;
  }
  return ((nextKg - prevKg) / days) * 1000;
}

export function summarizeWeights(
  weights: WeightPoint[],
  entryWeightKg?: number | null,
  options?: {
    penAverageWeightKg?: number | null;
    entryDate?: Date | null;
    referenceDate?: Date;
  }
): {
  entryWeight: number | null;
  currentWeight: number | null;
  totalGainKg: number | null;
  latestGmq: number | null;
  avgGmq: number | null;
  weightSource: WeightSource;
} {
  const now = options?.referenceDate ?? new Date();
  const sorted = [...weights].sort(
    (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()
  );
  const entry =
    entryWeightKg != null && entryWeightKg > 0
      ? entryWeightKg
      : sorted[0]?.weightKg ?? null;

  if (sorted.length > 0) {
    const current = sorted[sorted.length - 1].weightKg;
    const totalGainKg =
      entry != null && current != null ? current - entry : null;

    const gmqs: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const g = gmqBetween(
        sorted[i - 1].weightKg,
        sorted[i].weightKg,
        sorted[i - 1].measuredAt,
        sorted[i].measuredAt
      );
      if (g != null && Number.isFinite(g)) {
        gmqs.push(g);
      }
    }
    const latestGmq = gmqs.length ? gmqs[gmqs.length - 1] : null;
    const avgGmq =
      gmqs.length > 0
        ? gmqs.reduce((a, b) => a + b, 0) / gmqs.length
        : null;

    return {
      entryWeight: entry,
      currentWeight: current,
      totalGainKg,
      latestGmq,
      avgGmq,
      weightSource: "weigh"
    };
  }

  const penAvg = options?.penAverageWeightKg;
  if (penAvg != null && penAvg > 0) {
    const totalGainKg =
      entry != null && penAvg != null ? penAvg - entry : null;
    let latestGmq: number | null = null;
    if (
      entry != null &&
      options?.entryDate &&
      totalGainKg != null &&
      totalGainKg !== 0
    ) {
      const days =
        (now.getTime() - options.entryDate.getTime()) /
        (1000 * 60 * 60 * 24);
      if (days > 0) {
        latestGmq = (totalGainKg / days) * 1000;
      }
    }
    return {
      entryWeight: entry,
      currentWeight: penAvg,
      totalGainKg,
      latestGmq,
      avgGmq: latestGmq,
      weightSource: "pen_avg"
    };
  }

  if (entry != null && entry > 0) {
    return {
      entryWeight: entry,
      currentWeight: entry,
      totalGainKg: 0,
      latestGmq: null,
      avgGmq: null,
      weightSource: "entry"
    };
  }

  return {
    entryWeight: null,
    currentWeight: null,
    totalGainKg: null,
    latestGmq: null,
    avgGmq: null,
    weightSource: "estimated"
  };
}
