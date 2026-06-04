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

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Statut visuel : jauge colorée selon jours restants ou % restant. */
export function resolveFeedStockStatus(
  estimatedDaysRemaining: number | null,
  percentRemaining: number | null,
  hasSufficientData: boolean
): FeedStockComputedStatus {
  if (!hasSufficientData) {
    return "no_data";
  }
  const daysCrit =
    estimatedDaysRemaining != null && estimatedDaysRemaining < 15;
  const daysWarn =
    estimatedDaysRemaining != null &&
    estimatedDaysRemaining >= 15 &&
    estimatedDaysRemaining <= 30;
  const pctCrit = percentRemaining != null && percentRemaining < 20;
  const pctWarn =
    percentRemaining != null &&
    percentRemaining >= 20 &&
    percentRemaining <= 50;
  const daysOk =
    estimatedDaysRemaining != null && estimatedDaysRemaining > 30;
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
  feedTypeId: string
): Promise<FeedStockCalculationResult> {
  const debug = await computeFeedStockMetricsDebug(prisma, farmId, feedTypeId);
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
  feedTypeId: string
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

  const wp = toNum(feedType.weightPerBagKg);
  const latestCheck = checksDesc[0] ?? null;

  let currentStockKg: number;
  if (latestCheck) {
    const bags = toNum(latestCheck.bagsCounted);
    if (bags != null && wp != null && wp > 0) {
      currentStockKg = bags * wp;
    } else {
      currentStockKg = toNum(latestCheck.stockAfterKg) ?? 0;
    }
  } else {
    currentStockKg = toNum(feedType.currentStockKg) ?? 0;
  }

  const stockAtLastEntryKg = lastIn ? toNum(lastIn.stockAfterKg) : null;

  if (
    stockAtLastEntryKg != null &&
    currentStockKg > stockAtLastEntryKg + 0.01
  ) {
    warnings.push(
      "current_stock_kg > stock_at_last_entry — vérifiez les saisies."
    );
  }

  const intervals: FeedStockCalculationDebug["intervals"] = [];
  const checksChron = [...checksDesc].reverse();

  for (let i = 1; i < checksChron.length; i++) {
    const older = checksChron[i - 1]!;
    const newer = checksChron[i]!;
    const stockOlder = toNum(older.stockAfterKg) ?? 0;
    const stockNewer = toNum(newer.stockAfterKg) ?? 0;
    const consumedKg = stockOlder - stockNewer;
    const days = daysBetweenUtc(older.occurredAt, newer.occurredAt);

    if (consumedKg < 0) {
      const entryBetween = await prisma.feedStockMovement.count({
        where: {
          farmId,
          feedTypeId,
          kind: FeedMovementKind.in,
          occurredAt: { gt: older.occurredAt, lt: newer.occurredAt }
        }
      });
      if (entryBetween === 0) {
        warnings.push(
          "Stock en hausse entre deux contrôles sans entrée enregistrée."
        );
      }
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

  const recentIntervals = intervals.slice(-3);
  let avgDailyConsumptionKg: number | null = null;
  if (recentIntervals.length > 0) {
    const positive = recentIntervals.filter((x) => x.dailyKg > 0);
    if (positive.length > 0) {
      avgDailyConsumptionKg =
        positive.reduce((s, x) => s + x.dailyKg, 0) / positive.length;
    } else if (recentIntervals.some((x) => x.consumedKg <= 0)) {
      avgDailyConsumptionKg = null;
      warnings.push("Consommation nulle ou négative sur la période récente.");
    }
  }

  const hasSufficientData = checksDesc.length >= 2;

  if (avgDailyConsumptionKg != null && avgDailyConsumptionKg < 0) {
    warnings.push("avg_daily_consumption_kg négatif — données incohérentes.");
    avgDailyConsumptionKg = null;
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

  const now = new Date();
  const daysSinceLastCheck = latestCheck
    ? daysBetweenUtc(latestCheck.occurredAt, now)
    : null;

  const status = resolveFeedStockStatus(
    estimatedDaysRemaining,
    percentRemaining,
    hasSufficientData
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
