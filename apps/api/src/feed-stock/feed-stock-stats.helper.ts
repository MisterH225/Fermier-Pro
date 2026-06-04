import type { PrismaClient } from "@prisma/client";
import { FeedMovementKind } from "@prisma/client";
import { feedTypeColorAtIndex } from "./feed-type-colors";
import {
  computeFeedStockMetrics,
  daysBetweenUtc,
  FEED_STOCK_STATUS_COLORS,
  type FeedStockComputedStatus
} from "./feed-stock-calculation.helper";

export type FeedStockStatRow = {
  feedTypeId: string;
  name: string;
  color: string;
  currentStockKg: string;
  weightPerBagKg: string | null;
  bagCountCurrent: string | null;
  lastCheckDate: string | null;
  avgDailyConsumptionKg: string | null;
  daysRemaining: number | null;
  estimatedDepletionDate: string | null;
  status: "ok" | "warning" | "critical";
  percentConsumed: number | null;
  percentRemaining: number | null;
  stockAtLastEntry: string | null;
  daysSinceLastCheck: number | null;
  hasSufficientData: boolean;
  stockStatus: FeedStockComputedStatus;
  stockStatusColor: string;
};

const MS_PER_DAY = 86_400_000;

function mapDisplayStatus(
  stockStatus: FeedStockComputedStatus
): "ok" | "warning" | "critical" {
  if (stockStatus === "critical") return "critical";
  if (stockStatus === "warning") return "warning";
  return "ok";
}

export async function buildFeedStockStatsForFarm(
  prisma: PrismaClient,
  farmId: string,
  _thresholds: { criticalDays: number; warningDays: number }
): Promise<FeedStockStatRow[]> {
  const types = await prisma.feedType.findMany({
    where: { farmId },
    orderBy: { name: "asc" }
  });

  const now = new Date();

  const rows = await Promise.all(
    types.map(async (t, index) => {
      const metrics = await computeFeedStockMetrics(prisma, farmId, t.id);

      let estimatedDepletionDate: string | null = null;
      if (metrics.estimatedDaysRemaining != null && metrics.estimatedDaysRemaining > 0) {
        const depl = new Date(
          now.getTime() + metrics.estimatedDaysRemaining * MS_PER_DAY
        );
        estimatedDepletionDate = depl.toISOString().slice(0, 10);
      }

      const lastCheck = await prisma.feedStockMovement.findFirst({
        where: {
          farmId,
          feedTypeId: t.id,
          kind: FeedMovementKind.stock_check
        },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true }
      });

      return {
        feedTypeId: t.id,
        name: t.name,
        color: feedTypeColorAtIndex(index),
        currentStockKg: metrics.currentStockKg.toString(),
        weightPerBagKg: t.weightPerBagKg?.toString() ?? null,
        bagCountCurrent: t.bagCountCurrent?.toString() ?? null,
        lastCheckDate: lastCheck?.occurredAt.toISOString() ?? null,
        avgDailyConsumptionKg:
          metrics.avgDailyConsumptionKg != null
            ? metrics.avgDailyConsumptionKg.toFixed(4)
            : null,
        daysRemaining: metrics.estimatedDaysRemaining,
        estimatedDepletionDate,
        status: mapDisplayStatus(metrics.status),
        percentConsumed: metrics.percentConsumed,
        percentRemaining: metrics.percentRemaining,
        stockAtLastEntry:
          metrics.stockAtLastEntryKg != null
            ? metrics.stockAtLastEntryKg.toString()
            : null,
        daysSinceLastCheck: metrics.daysSinceLastCheck,
        hasSufficientData: metrics.hasSufficientData,
        stockStatus: metrics.status,
        stockStatusColor: FEED_STOCK_STATUS_COLORS[metrics.status]
      };
    })
  );

  return rows;
}

export async function feedStockConsumptionSpikeMessages(
  prisma: PrismaClient,
  farmId: string
): Promise<{ ruleKey: string; message: string }[]> {
  const items: { ruleKey: string; message: string }[] = [];
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setUTCMonth(twoMonthsAgo.getUTCMonth() - 2);

  for (const t of await prisma.feedType.findMany({
    where: { farmId },
    select: { id: true, name: true }
  })) {
    const recent = await prisma.feedStockMovement.findMany({
      where: {
        farmId,
        feedTypeId: t.id,
        kind: FeedMovementKind.stock_check,
        occurredAt: { gte: twoMonthsAgo }
      },
      orderBy: { occurredAt: "asc" },
      select: { dailyConsumptionKg: true, occurredAt: true }
    });
    if (recent.length >= 2) {
      const a = recent[0].dailyConsumptionKg?.toNumber();
      const b = recent[recent.length - 1].dailyConsumptionKg?.toNumber();
      if (a != null && b != null && a > 0 && b > a * 1.2) {
        const pct = Math.round(((b - a) / a) * 100);
        items.push({
          ruleKey: `stock-spike:${t.id}`,
          message: `Consommation « ${t.name} » anormalement haute ce mois (≈ +${pct} % vs début de période).`
        });
      }
    }
  }
  return items;
}

export { daysBetweenUtc };
