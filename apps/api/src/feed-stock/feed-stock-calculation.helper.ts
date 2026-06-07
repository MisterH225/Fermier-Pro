import type { PrismaClient } from "@prisma/client";
import { FeedMovementKind, Prisma } from "@prisma/client";

const MS_PER_DAY = 86_400_000;

export const FEED_STOCK_STATUS_COLORS = {
  ok: "#1D9E75",
  warning: "#BA7517",
  critical: "#E24B4A",
  no_data: "#B4B2A9"
} as const;

export type FeedStockComputedStatus = keyof typeof FEED_STOCK_STATUS_COLORS;

export type FeedStockCalculationResult = {
  feedTypeId: string;
  currentStockKg: number;
  stockAtLastEntryKg: number | null;
  percentConsumed: number | null;
  percentRemaining: number | null;
  avgDailyConsumptionKg: number | null;
  estimatedDaysRemaining: number | null;
  daysSinceLastCheck: number | null;
  hasSufficientData: boolean;
  status: FeedStockComputedStatus;
  warnings: string[];
};

export type FeedStockCalculationDebug = FeedStockCalculationResult & {
  checks: Array<{
    id: string;
    occurredAt: string;
    stockAfterKg: number;
    bagsCounted: number | null;
  }>;
  intervals: Array<{
    fromCheckId: string;
    toCheckId: string;
    days: number;
    consumedKg: number;
    dailyKg: number;
  }>;
  lastEntry: { id: string; occurredAt: string; stockAfterKg: number; quantityKg: number } | null;
};

function toNum(d: Prisma.Decimal | null | undefined): number | null {
  if (d == null) return null;
  const n = d.toNumber();
  return Number.isFinite(n) ? n : null;
}

export function daysBetweenUtc(a: Date, b: Date): number {
  const d = Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
  return Math.max(1, d);
}

/** Jours calendaires écoulés entre deux dates (0 si même jour). */
export function calendarDaysElapsed(from: Date, to: Date): number {
  const d = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
  return Math.max(0, d);
}

/** Somme en mémoire (évite N agrégats SQL par intervalle). */
export function sumEntryKgFromMovements(
  entries: Array<{ occurredAt: Date; quantityKg: number | null }>,
  afterExclusive: Date,
  beforeInclusive: Date
): number {
  let sum = 0;
  for (const e of entries) {
    if (e.occurredAt > afterExclusive && e.occurredAt <= beforeInclusive) {
      sum += e.quantityKg ?? 0;
    }
  }
  return sum;
}

/** Somme des entrées `in` strictement après `afterExclusive`, jusqu'à `beforeInclusive`. */
export async function sumEntryKgBetween(
  prisma: PrismaClient,
  farmId: string,
  feedTypeId: string,
  afterExclusive: Date,
  beforeInclusive: Date
): Promise<number> {
  const result = await prisma.feedStockMovement.aggregate({
    where: {
      farmId,
      feedTypeId,
      kind: FeedMovementKind.in,
      occurredAt: { gt: afterExclusive, lte: beforeInclusive }
    },
    _sum: { quantityKg: true }
  });
  return toNum(result._sum.quantityKg) ?? 0;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export type ResolveCurrentStockKgInput = {
  ledgerStockKg: number;
  latestCheck: {
    occurredAt: Date;
    bagsCounted: number | null;
    stockAfterKg: number | null;
  } | null;
  lastInOccurredAt: Date | null;
  weightPerBagKg: number | null;
};

/**
 * Stock courant : registre (`feedType.currentStockKg`) sauf si le dernier
 * événement est un contrôle physique (pas d'entrée plus récente).
 */
export type ConsumptionInterval = {
  fromCheckId: string;
  toCheckId: string;
  days: number;
  consumedKg: number;
  dailyKg: number;
};

function resolveCheckStockKg(
  check: { bagsCounted: number | null; stockAfterKg: number | null },
  weightPerBagKg: number | null
): number {
  const bags = check.bagsCounted;
  if (bags != null && weightPerBagKg != null && weightPerBagKg > 0) {
    return bags * weightPerBagKg;
  }
  return check.stockAfterKg ?? 0;
}

/**
 * Moyenne journalière pondérée : Σ consommation / Σ jours (pas une moyenne
 * arithmétique des taux de chaque intervalle).
 */
export function computeWeightedAvgDailyKg(
  intervals: Array<Pick<ConsumptionInterval, "days" | "consumedKg">>
): number | null {
  const positive = intervals.filter((x) => x.consumedKg > 0 && x.days > 0);
  if (positive.length === 0) {
    return null;
  }
  const totalConsumed = positive.reduce((s, x) => s + x.consumedKg, 0);
  const totalDays = positive.reduce((s, x) => s + x.days, 0);
  if (totalDays <= 0 || totalConsumed <= 0) {
    return null;
  }
  return totalConsumed / totalDays;
}

export function buildConsumptionIntervals(input: {
  checksChron: Array<{
    id: string;
    occurredAt: Date;
    stockAfterKg: number | null;
    bagsCounted: number | null;
  }>;
  entryRows: Array<{
    id: string;
    occurredAt: Date;
    quantityKg: number | null;
    stockAfterKg: number | null;
  }>;
  weightPerBagKg: number | null;
}): { intervals: ConsumptionInterval[]; warnings: string[] } {
  const warnings: string[] = [];
  const intervals: ConsumptionInterval[] = [];
  const { checksChron, entryRows, weightPerBagKg } = input;

  if (checksChron.length >= 1) {
    const firstCheck = checksChron[0]!;
    const entriesBeforeCheck = entryRows.filter(
      (e) => e.occurredAt <= firstCheck.occurredAt
    );
    const firstIn = entriesBeforeCheck[0];
    if (firstIn) {
      const stockBeforeFirstEntry =
        (firstIn.stockAfterKg ?? 0) - (firstIn.quantityKg ?? 0);
      const totalInKg = entriesBeforeCheck.reduce(
        (s, e) => s + (e.quantityKg ?? 0),
        0
      );
      const stockCheck = resolveCheckStockKg(
        {
          bagsCounted: firstCheck.bagsCounted,
          stockAfterKg: firstCheck.stockAfterKg
        },
        weightPerBagKg
      );
      const consumedKg = stockBeforeFirstEntry + totalInKg - stockCheck;
      const days = daysBetweenUtc(firstIn.occurredAt, firstCheck.occurredAt);
      const dailyKg = consumedKg > 0 ? consumedKg / days : 0;
      intervals.push({
        fromCheckId: firstIn.id,
        toCheckId: firstCheck.id,
        days,
        consumedKg,
        dailyKg
      });
    }
  }

  for (let i = 1; i < checksChron.length; i++) {
    const older = checksChron[i - 1]!;
    const newer = checksChron[i]!;
    const stockOlder = resolveCheckStockKg(
      {
        bagsCounted: older.bagsCounted,
        stockAfterKg: older.stockAfterKg
      },
      weightPerBagKg
    );
    const stockNewer = resolveCheckStockKg(
      {
        bagsCounted: newer.bagsCounted,
        stockAfterKg: newer.stockAfterKg
      },
      weightPerBagKg
    );
    const entriesKg = sumEntryKgFromMovements(
      entryRows,
      older.occurredAt,
      newer.occurredAt
    );
    const consumedKg = stockOlder + entriesKg - stockNewer;
    const days = daysBetweenUtc(older.occurredAt, newer.occurredAt);

    if (consumedKg < 0 && entriesKg <= 0) {
      warnings.push(
        "Stock en hausse entre deux contrôles sans entrée enregistrée."
      );
    }

    const dailyKg = consumedKg > 0 ? consumedKg / days : 0;
    intervals.push({
      fromCheckId: older.id,
      toCheckId: newer.id,
      days,
      consumedKg,
      dailyKg
    });
  }

  return { intervals, warnings };
}

/**
 * Intervalles pour le taux de conso : privilégie les périodes entre deux
 * contrôles (≥ 2) pour éviter de diluer avec l'intervalle entrée → 1er contrôle.
 */
export function selectConsumptionRateIntervals(
  intervals: ConsumptionInterval[],
  entryIds: ReadonlySet<string>
): ConsumptionInterval[] {
  const betweenChecks = intervals.filter((i) => !entryIds.has(i.fromCheckId));
  if (betweenChecks.length >= 2) {
    return betweenChecks.slice(-3);
  }
  if (betweenChecks.length === 1) {
    return betweenChecks;
  }
  return intervals.slice(-3);
}

export type StockAnchorSource = "check" | "entry" | "ledger";

export type StockAnchor = {
  stockKg: number;
  anchorDate: Date;
  source: StockAnchorSource;
};

/** L'entrée l'emporte si elle est postérieure ou le même jour qu'un contrôle. */
export function isEntryLatestStockEvent(input: {
  latestCheck: { occurredAt: Date } | null;
  lastIn: { occurredAt: Date } | null;
}): boolean {
  const { latestCheck, lastIn } = input;
  if (!lastIn) {
    return false;
  }
  if (!latestCheck) {
    return true;
  }
  return lastIn.occurredAt >= latestCheck.occurredAt;
}

export function resolveStockAnchor(input: {
  ledgerStockKg: number;
  latestCheck: {
    occurredAt: Date;
    bagsCounted: number | null;
    stockAfterKg: number | null;
  } | null;
  lastIn: {
    occurredAt: Date;
    stockAfterKg: number | null;
  } | null;
  weightPerBagKg: number | null;
  asOf: Date;
}): StockAnchor {
  const check = input.latestCheck;
  const lastIn = input.lastIn;

  if (isEntryLatestStockEvent({ latestCheck: check, lastIn })) {
    if (lastIn && lastIn.stockAfterKg != null) {
      return {
        stockKg: lastIn.stockAfterKg,
        anchorDate: lastIn.occurredAt,
        source: "entry"
      };
    }
    return {
      stockKg: input.ledgerStockKg,
      anchorDate: lastIn?.occurredAt ?? input.asOf,
      source: "entry"
    };
  }

  if (check) {
    return {
      stockKg: resolveCheckStockKg(check, input.weightPerBagKg),
      anchorDate: check.occurredAt,
      source: "check"
    };
  }
  if (lastIn && lastIn.stockAfterKg != null) {
    return {
      stockKg: lastIn.stockAfterKg,
      anchorDate: lastIn.occurredAt,
      source: "entry"
    };
  }
  return {
    stockKg: input.ledgerStockKg,
    anchorDate: input.asOf,
    source: "ledger"
  };
}

/** Ne conserve que les intervalles dont le contrôle final est postérieur à l'entrée. */
export function filterConsumptionIntervalsAfterEntry(
  intervals: ConsumptionInterval[],
  checksChron: Array<{ id: string; occurredAt: Date }>,
  lastInOccurredAt: Date
): ConsumptionInterval[] {
  return intervals.filter((i) => {
    const toCheck = checksChron.find((c) => c.id === i.toCheckId);
    return toCheck != null && toCheck.occurredAt > lastInOccurredAt;
  });
}

/** Estime le stock actuel en amortissant la conso depuis le dernier point d'ancrage. */
export function projectStockFromAnchor(
  anchor: StockAnchor,
  avgDailyKg: number | null,
  asOf: Date
): number {
  const daysElapsed = calendarDaysElapsed(anchor.anchorDate, asOf);
  if (avgDailyKg == null || avgDailyKg <= 0 || daysElapsed <= 0) {
    return anchor.stockKg;
  }
  return Math.max(0, anchor.stockKg - avgDailyKg * daysElapsed);
}

export function resolveCurrentStockKg(input: ResolveCurrentStockKgInput): number {
  const ledger = Number.isFinite(input.ledgerStockKg) ? input.ledgerStockKg : 0;
  const check = input.latestCheck;
  if (!check) {
    return ledger;
  }

  const wp = input.weightPerBagKg;
  const bags = check.bagsCounted;
  let checkStockKg = check.stockAfterKg ?? 0;
  if (bags != null && wp != null && wp > 0) {
    checkStockKg = bags * wp;
  }

  const lastInAt = input.lastInOccurredAt;
  if (!lastInAt || check.occurredAt >= lastInAt) {
    return checkStockKg;
  }

  return ledger;
}

export type FeedStockStatusThresholds = {
  criticalDays: number;
  warningDays: number;
};

/** Statut visuel : jauge colorée selon jours restants ou % restant. */
export function resolveFeedStockStatus(
  estimatedDaysRemaining: number | null,
  percentRemaining: number | null,
  hasSufficientData: boolean,
  thresholds?: FeedStockStatusThresholds
): FeedStockComputedStatus {
  if (!hasSufficientData) {
    return "no_data";
  }
  const criticalDays = thresholds?.criticalDays ?? 15;
  const warningDays = thresholds?.warningDays ?? 30;
  const daysCrit =
    estimatedDaysRemaining != null && estimatedDaysRemaining < criticalDays;
  const daysWarn =
    estimatedDaysRemaining != null &&
    estimatedDaysRemaining >= criticalDays &&
    estimatedDaysRemaining <= warningDays;
  const pctCrit = percentRemaining != null && percentRemaining < 20;
  const pctWarn =
    percentRemaining != null &&
    percentRemaining >= 20 &&
    percentRemaining <= 50;
  const daysOk =
    estimatedDaysRemaining != null && estimatedDaysRemaining > warningDays;
  const pctOk = percentRemaining != null && percentRemaining > 50;

  if (daysCrit || pctCrit) {
    return "critical";
  }
  if (daysWarn || pctWarn) {
    return "warning";
  }
  if (daysOk || pctOk) {
    return "ok";
  }
  if (estimatedDaysRemaining == null && percentRemaining == null) {
    return "no_data";
  }
  return "ok";
}

/**
 * Calcule les métriques stock à partir des mouvements réels (contrôles + entrées).
 */
export async function computeFeedStockMetrics(
  prisma: PrismaClient,
  farmId: string,
  feedTypeId: string,
  thresholds?: FeedStockStatusThresholds,
  asOf?: Date
): Promise<FeedStockCalculationResult> {
  const debug = await computeFeedStockMetricsDebug(
    prisma,
    farmId,
    feedTypeId,
    thresholds,
    asOf
  );
  const {
    checks: _c,
    intervals: _i,
    lastEntry: _l,
    ...result
  } = debug;
  return result;
}

export async function computeFeedStockMetricsDebug(
  prisma: PrismaClient,
  farmId: string,
  feedTypeId: string,
  thresholds?: FeedStockStatusThresholds,
  asOf: Date = new Date()
): Promise<FeedStockCalculationDebug> {
  const warnings: string[] = [];

  const feedType = await prisma.feedType.findFirst({
    where: { id: feedTypeId, farmId }
  });
  if (!feedType) {
    throw new Error("Feed type not found");
  }

  const checksDesc = await prisma.feedStockMovement.findMany({
    where: { farmId, feedTypeId, kind: FeedMovementKind.stock_check },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 10,
    select: {
      id: true,
      occurredAt: true,
      stockAfterKg: true,
      bagsCounted: true
    }
  });

  const lastIn = await prisma.feedStockMovement.findFirst({
    where: { farmId, feedTypeId, kind: FeedMovementKind.in },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      occurredAt: true,
      stockAfterKg: true,
      quantityKg: true
    }
  });

  const entryMovements = await prisma.feedStockMovement.findMany({
    where: { farmId, feedTypeId, kind: FeedMovementKind.in },
    select: { id: true, occurredAt: true, quantityKg: true, stockAfterKg: true },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
  });
  const entryRows = entryMovements.map((e) => ({
    id: e.id,
    occurredAt: e.occurredAt,
    quantityKg: toNum(e.quantityKg),
    stockAfterKg: toNum(e.stockAfterKg)
  }));

  const wp = toNum(feedType.weightPerBagKg);
  const latestCheck = checksDesc[0] ?? null;
  const ledgerStockKg = toNum(feedType.currentStockKg) ?? 0;

  const stockAtLastEntryKg = lastIn ? toNum(lastIn.stockAfterKg) : null;

  const checksChron = [...checksDesc].reverse().map((c) => ({
    id: c.id,
    occurredAt: c.occurredAt,
    stockAfterKg: toNum(c.stockAfterKg),
    bagsCounted: toNum(c.bagsCounted)
  }));

  const built = buildConsumptionIntervals({
    checksChron,
    entryRows,
    weightPerBagKg: wp
  });
  const intervals = built.intervals;
  warnings.push(...built.warnings);

  const entryIds = new Set(entryRows.map((e) => e.id));
  const entryIsLatest = isEntryLatestStockEvent({
    latestCheck,
    lastIn
  });
  let rateIntervals = selectConsumptionRateIntervals(intervals, entryIds);
  if (entryIsLatest && lastIn) {
    rateIntervals = filterConsumptionIntervalsAfterEntry(
      rateIntervals,
      checksChron,
      lastIn.occurredAt
    );
  }
  let avgDailyConsumptionKg = computeWeightedAvgDailyKg(rateIntervals);
  if (
    rateIntervals.length > 0 &&
    avgDailyConsumptionKg == null &&
    rateIntervals.some((x) => x.consumedKg <= 0)
  ) {
    warnings.push("Consommation nulle ou négative sur la période récente.");
  }

  const hasSufficientData = rateIntervals.some(
    (x) => x.consumedKg > 0 && x.days > 0
  );

  if (avgDailyConsumptionKg != null && avgDailyConsumptionKg < 0) {
    warnings.push("avg_daily_consumption_kg négatif — données incohérentes.");
    avgDailyConsumptionKg = null;
  }

  const anchor = resolveStockAnchor({
    ledgerStockKg,
    latestCheck: latestCheck
      ? {
          occurredAt: latestCheck.occurredAt,
          bagsCounted: toNum(latestCheck.bagsCounted),
          stockAfterKg: toNum(latestCheck.stockAfterKg)
        }
      : null,
    lastIn: lastIn
      ? {
          occurredAt: lastIn.occurredAt,
          stockAfterKg: toNum(lastIn.stockAfterKg)
        }
      : null,
    weightPerBagKg: wp,
    asOf
  });
  const currentStockKg =
    entryIsLatest
      ? anchor.stockKg
      : projectStockFromAnchor(anchor, avgDailyConsumptionKg, asOf);

  if (
    stockAtLastEntryKg != null &&
    currentStockKg > stockAtLastEntryKg + 0.01
  ) {
    warnings.push(
      "current_stock_kg > stock_at_last_entry — vérifiez les saisies."
    );
  }

  let percentConsumed: number | null = null;
  let percentRemaining: number | null = null;
  if (stockAtLastEntryKg != null && stockAtLastEntryKg > 0) {
    const raw =
      ((stockAtLastEntryKg - currentStockKg) / stockAtLastEntryKg) * 100;
    percentConsumed = clampPercent(raw);
    percentRemaining = clampPercent(100 - percentConsumed);
  }

  let estimatedDaysRemaining: number | null = null;
  if (!hasSufficientData) {
    estimatedDaysRemaining = null;
  } else if (avgDailyConsumptionKg == null) {
    estimatedDaysRemaining = null;
  } else if (avgDailyConsumptionKg <= 0) {
    estimatedDaysRemaining = null;
  } else if (currentStockKg > 0) {
    estimatedDaysRemaining = Math.floor(currentStockKg / avgDailyConsumptionKg);
  } else {
    estimatedDaysRemaining = 0;
  }

  const daysSinceLastCheck = latestCheck
    ? calendarDaysElapsed(latestCheck.occurredAt, asOf)
    : null;

  const status = resolveFeedStockStatus(
    estimatedDaysRemaining,
    percentRemaining,
    hasSufficientData,
    thresholds
  );

  return {
    feedTypeId,
    currentStockKg,
    stockAtLastEntryKg,
    percentConsumed,
    percentRemaining,
    avgDailyConsumptionKg,
    estimatedDaysRemaining,
    daysSinceLastCheck,
    hasSufficientData,
    status,
    warnings,
    checks: checksDesc.map((c) => ({
      id: c.id,
      occurredAt: c.occurredAt.toISOString(),
      stockAfterKg: toNum(c.stockAfterKg) ?? 0,
      bagsCounted: toNum(c.bagsCounted)
    })),
    intervals,
    lastEntry: lastIn
      ? {
          id: lastIn.id,
          occurredAt: lastIn.occurredAt.toISOString(),
          stockAfterKg: toNum(lastIn.stockAfterKg) ?? 0,
          quantityKg: toNum(lastIn.quantityKg) ?? 0
        }
      : null
  };
}
