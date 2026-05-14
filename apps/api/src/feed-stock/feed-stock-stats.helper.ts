import type { PrismaClient } from "@prisma/client";
import { FeedMovementKind } from "@prisma/client";

const MS_PER_DAY = 86_400_000;

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
};

function daysBetweenUtc(a: Date, b: Date): number {
  const d = Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
  return Math.max(1, d);
}

export async function buildFeedStockStatsForFarm(
  prisma: PrismaClient,
  farmId: string,
  thresholds: { criticalDays: number; warningDays: number }
): Promise<FeedStockStatRow[]> {
  const types = await prisma.feedType.findMany({ where: { farmId } });
  const lastChecksRaw = await prisma.feedStockMovement.findMany({
    where: { farmId, kind: FeedMovementKind.stock_check },
    orderBy: { occurredAt: "desc" },
    select: {
      feedTypeId: true,
      dailyConsumptionKg: true,
      occurredAt: true
    }
  });
  const dailyByType = new Map<string, (typeof lastChecksRaw)[0]>();
  for (const r of lastChecksRaw) {
    if (!dailyByType.has(r.feedTypeId)) {
      dailyByType.set(r.feedTypeId, r);
    }
  }

  const now = new Date();
  const { criticalDays, warningDays } = thresholds;

  return types.map((t) => {
    const last = dailyByType.get(t.id);
    const daily = last?.dailyConsumptionKg?.toNumber() ?? null;
    const stock = t.currentStockKg.toNumber();
    let daysRemaining: number | null = null;
    let estimatedDepletionDate: string | null = null;
    if (daily != null && daily > 0 && stock > 0) {
      daysRemaining = Math.floor(stock / daily);
      const depl = new Date(now.getTime() + daysRemaining * MS_PER_DAY);
      estimatedDepletionDate = depl.toISOString().slice(0, 10);
    }
    let status: "ok" | "warning" | "critical" = "ok";
    if (daysRemaining != null) {
      const crit = Math.min(criticalDays, t.lowStockThresholdDays);
      const warn = Math.max(warningDays, crit + 1);
      if (daysRemaining < crit) status = "critical";
      else if (daysRemaining <= warn) status = "warning";
      else status = "ok";
    }
    return {
      feedTypeId: t.id,
      name: t.name,
      color: t.color,
      currentStockKg: t.currentStockKg.toString(),
      weightPerBagKg: t.weightPerBagKg?.toString() ?? null,
      bagCountCurrent: t.bagCountCurrent?.toString() ?? null,
      lastCheckDate: t.lastCheckDate?.toISOString() ?? null,
      avgDailyConsumptionKg: last?.dailyConsumptionKg?.toString() ?? null,
      daysRemaining,
      estimatedDepletionDate,
      status
    };
  });
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
