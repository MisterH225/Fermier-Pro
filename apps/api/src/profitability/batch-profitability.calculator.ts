import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { gmqBetween } from "../cheptel/cheptel-gmq.util";
import { dec, pct, safeDiv } from "./profitability-period.util";
import type {
  BatchProfitabilityResult,
  ProfitabilityDataQuality,
  ProfitabilityMetrics
} from "./profitability.types";

function buildBatchMetrics(params: {
  revenues: number;
  costsDirect: number;
  costsIndirect: number;
  kgProduced: number | null;
}): ProfitabilityMetrics {
  const costsTotal = params.costsDirect + params.costsIndirect;
  const grossMargin = params.revenues - params.costsDirect;
  const netMargin = params.revenues - costsTotal;
  const kg = params.kgProduced;
  return {
    revenues: params.revenues,
    costsDirect: params.costsDirect,
    costsIndirect: params.costsIndirect,
    costsTotal,
    grossMargin,
    grossMarginPct: pct(grossMargin, params.revenues),
    netMargin,
    netMarginPct: pct(netMargin, params.revenues),
    costPerKg: kg != null && kg > 0 ? safeDiv(costsTotal, kg) : null,
    roi: costsTotal > 0 ? pct(netMargin, costsTotal) : null,
    breakevenPricePerKg:
      kg != null && kg > 0 ? safeDiv(costsTotal, kg) : null,
    kgProduced: kg
  };
}

async function allocateFarmFeedCost(
  prisma: PrismaClient,
  farmId: string,
  batchId: string,
  batchHeadcount: number,
  batchStart: Date
): Promise<{ amount: number; warning: string | null }> {
  const linkedFeed = await prisma.farmExpense.aggregate({
    where: {
      farmId,
      linkedEntityType: "batch",
      linkedEntityId: batchId,
      financeCategory: { key: "feed" }
    },
    _sum: { amount: true }
  });
  const linked = dec(linkedFeed._sum.amount);
  if (linked > 0) {
    return { amount: linked, warning: null };
  }

  const batches = await prisma.livestockBatch.findMany({
    where: { farmId, status: { in: ["active", "open"] } },
    select: { id: true, headcount: true, createdAt: true }
  });
  const now = Date.now();
  let farmAnimalDays = 0;
  let batchAnimalDays = 0;
  for (const b of batches) {
    const days = Math.max(
      1,
      (now - b.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const ad = b.headcount * days;
    farmAnimalDays += ad;
    if (b.id === batchId) {
      batchAnimalDays = ad;
    }
  }
  if (batchAnimalDays === 0) {
    batchAnimalDays = batchHeadcount * Math.max(
      1,
      (now - batchStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    farmAnimalDays += batchAnimalDays;
  }

  const feedAgg = await prisma.farmExpense.aggregate({
    where: {
      farmId,
      financeCategory: { key: "feed" }
    },
    _sum: { amount: true }
  });
  const totalFeed = dec(feedAgg._sum.amount);
  if (totalFeed <= 0 || farmAnimalDays <= 0) {
    return {
      amount: 0,
      warning:
        "Coût aliment non attribué à cette bande — enregistrez des dépenses aliment ou liez-les à la bande."
    };
  }
  return {
    amount: (totalFeed * batchAnimalDays) / farmAnimalDays,
    warning: null
  };
}

export async function calculateBatchProfitability(
  prisma: PrismaClient,
  farmId: string,
  batchId: string,
  marketPricePerKg: number | null
): Promise<BatchProfitabilityResult> {
  const batch = await prisma.livestockBatch.findFirst({
    where: { id: batchId, farmId },
    include: {
      weights: { orderBy: { measuredAt: "asc" } },
      livestockExits: {
        where: { kind: "sale" },
        select: {
          price: true,
          weightKg: true,
          headcountAffected: true,
          occurredAt: true
        }
      }
    }
  });
  if (!batch) {
    throw new Error("Bande introuvable");
  }

  const settings = await prisma.farmFinanceSettings.findUnique({
    where: { farmId }
  });
  const currency = settings?.currencyCode ?? "XOF";
  const isClosed = batch.status === "closed" || batch.closedAt != null;
  const status: "open" | "closed" = isClosed ? "closed" : "open";

  const [revLinked, expLinked, linkedFeedAgg, feedAlloc] = await Promise.all([
    prisma.farmRevenue.aggregate({
      where: {
        farmId,
        linkedEntityType: "batch",
        linkedEntityId: batchId
      },
      _sum: { amount: true }
    }),
    prisma.farmExpense.aggregate({
      where: {
        farmId,
        linkedEntityType: "batch",
        linkedEntityId: batchId
      },
      _sum: { amount: true }
    }),
    prisma.farmExpense.aggregate({
      where: {
        farmId,
        linkedEntityType: "batch",
        linkedEntityId: batchId,
        financeCategory: { key: "feed" }
      },
      _sum: { amount: true }
    }),
    allocateFarmFeedCost(
      prisma,
      farmId,
      batchId,
      batch.headcount,
      batch.createdAt
    )
  ]);

  let exitRevenue = 0;
  let kgSold = 0;
  let animalsSold = 0;
  for (const e of batch.livestockExits) {
    exitRevenue += dec(e.price);
    animalsSold += e.headcountAffected ?? 1;
    if (e.weightKg != null && dec(e.weightKg) > 0) {
      kgSold += dec(e.weightKg);
    }
  }

  const revenuesRealized = dec(revLinked._sum.amount) + exitRevenue;
  const linkedFeed = dec(linkedFeedAgg._sum.amount);
  const costsDirect =
    dec(expLinked._sum.amount) + (linkedFeed > 0 ? 0 : feedAlloc.amount);
  const costsIndirect = 0;

  const warnings: string[] = [];
  if (feedAlloc.warning) {
    warnings.push(feedAlloc.warning);
  }

  const latestWeight = batch.weights[batch.weights.length - 1];
  const firstWeight = batch.weights[0];
  let kgProduced: number | null = null;
  if (kgSold > 0) {
    kgProduced = kgSold;
  } else if (latestWeight && batch.headcount > 0) {
    kgProduced = dec(latestWeight.avgWeightKg) * batch.headcount;
  }

  const realizedMetrics = buildBatchMetrics({
    revenues: revenuesRealized,
    costsDirect,
    costsIndirect,
    kgProduced
  });

  let gmqActual: number | null = null;
  let icActual: number | null = null;
  let durationDays: number | null = null;
  if (firstWeight && latestWeight && batch.weights.length >= 2) {
    gmqActual = gmqBetween(
      dec(firstWeight.avgWeightKg),
      dec(latestWeight.avgWeightKg),
      firstWeight.measuredAt,
      latestWeight.measuredAt
    );
    const gainKg =
      (dec(latestWeight.avgWeightKg) - dec(firstWeight.avgWeightKg)) *
      batch.headcount;
    if (gainKg > 0 && feedAlloc.amount > 0 && marketPricePerKg) {
      const feedTypes = await prisma.feedType.findMany({
        where: { farmId },
        select: { currentPumpPrice: true }
      });
      const avgPump =
        feedTypes.reduce((s, f) => s + dec(f.currentPumpPrice), 0) /
        Math.max(1, feedTypes.length);
      if (avgPump > 0) {
        const feedKg = feedAlloc.amount / avgPump;
        icActual = safeDiv(feedKg, gainKg);
      }
    }
  }
  const endRef = batch.closedAt ?? new Date();
  durationDays = Math.max(
    1,
    Math.round(
      (endRef.getTime() - batch.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  const animalsRemaining = Math.max(0, batch.headcount - animalsSold);
  let projectedRevenues: number | null = null;
  let projectedCosts: number | null = null;
  let remainingDays: number | null = null;
  let confidence: "high" | "medium" | "low" | null = null;

  if (status === "open" && animalsRemaining > 0 && latestWeight && marketPricePerKg) {
    const avgW = dec(latestWeight.avgWeightKg);
    const gmq = gmqActual ?? 500;
    const targetW = avgW + (gmq / 1000) * 30;
    remainingDays = gmq > 0 ? Math.round(((targetW - avgW) / (gmq / 1000))) : null;
    projectedRevenues = animalsRemaining * targetW * marketPricePerKg;
    projectedCosts = (feedAlloc.amount / Math.max(1, batch.headcount)) * animalsRemaining;
    confidence = batch.weights.length >= 2 ? "medium" : "low";
  }

  const projectedMetrics = buildBatchMetrics({
    revenues: projectedRevenues ?? 0,
    costsDirect: projectedCosts ?? 0,
    costsIndirect: 0,
    kgProduced:
      animalsRemaining > 0 && latestWeight
        ? dec(latestWeight.avgWeightKg) * animalsRemaining
        : null
  });
  if (projectedRevenues == null) {
    projectedMetrics.revenues = null;
    projectedMetrics.grossMargin = null;
    projectedMetrics.netMargin = null;
  }

  const combined = buildBatchMetrics({
    revenues: (realizedMetrics.revenues ?? 0) + (projectedMetrics.revenues ?? 0),
    costsDirect:
      (realizedMetrics.costsDirect ?? 0) + (projectedMetrics.costsDirect ?? 0),
    costsIndirect: 0,
    kgProduced:
      (realizedMetrics.kgProduced ?? 0) + (projectedMetrics.kgProduced ?? 0) ||
      null
  });

  const profSettings = await prisma.farmProfitabilitySettings.findUnique({
    where: { farmId }
  });
  const gmqSettings = await prisma.farmGmqSettings.findFirst({
    where: { farmId, categoryKey: batch.categoryKey ?? "finishing" }
  });

  const vsTargets = [
    {
      metric: "IC",
      actual: icActual,
      target: profSettings
        ? dec(profSettings.icTargetFattening)
        : null,
      delta:
        icActual != null && profSettings
          ? icActual - dec(profSettings.icTargetFattening)
          : null
    },
    {
      metric: "GMQ",
      actual: gmqActual,
      target: gmqSettings?.targetGmqGPerDay
        ? dec(gmqSettings.targetGmqGPerDay)
        : profSettings?.gmqRefFattening ?? null,
      delta:
        gmqActual != null && gmqSettings?.targetGmqGPerDay
          ? gmqActual - dec(gmqSettings.targetGmqGPerDay)
          : null
    },
    {
      metric: "Coût/kg",
      actual: realizedMetrics.costPerKg,
      target: marketPricePerKg,
      delta:
        realizedMetrics.costPerKg != null && marketPricePerKg
          ? realizedMetrics.costPerKg - marketPricePerKg
          : null
    }
  ];

  let dataQuality: ProfitabilityDataQuality = "insufficient";
  let dataQualityMessage: string | null =
    "Pas encore assez de données pour cette bande.";
  if (revenuesRealized > 0 || costsDirect > 0) {
    dataQuality = kgProduced != null && kgProduced > 0 ? "sufficient" : "partial";
    dataQualityMessage =
      dataQuality === "partial"
        ? "Marge calculée sans poids vendu fiable — coût/kg indisponible."
        : null;
  }

  return {
    batchId: batch.id,
    batchName: batch.name,
    categoryKey: batch.categoryKey,
    status,
    headcount: batch.headcount,
    animalsSold,
    animalsRemaining,
    periodStart: batch.createdAt.toISOString(),
    periodEnd: batch.closedAt?.toISOString() ?? null,
    currency,
    dataQuality,
    dataQualityMessage,
    realized: {
      ...realizedMetrics,
      icActual,
      gmqActual,
      durationDays,
      revenuePerAnimal:
        animalsSold > 0 ? safeDiv(revenuesRealized, animalsSold) : null
    },
    projected: {
      ...projectedMetrics,
      remainingDaysEstimate: remainingDays,
      confidence
    },
    combined,
    vsTargets,
    warnings,
    snapshotAt: new Date().toISOString()
  };
}

export async function persistBatchSnapshot(
  prisma: PrismaClient,
  farmId: string,
  result: BatchProfitabilityResult
): Promise<void> {
  const r = result.realized;
  const p = result.projected;
  await prisma.batchProfitabilitySnapshot.upsert({
    where: { batchId: result.batchId },
    create: {
      farmId,
      batchId: result.batchId,
      status: result.status === "closed" ? "closed" : "open",
      revenuesRealized: new Prisma.Decimal(r.revenues ?? 0),
      revenuesProjected:
        p.revenues != null ? new Prisma.Decimal(p.revenues) : null,
      costsDirectRealized: new Prisma.Decimal(r.costsDirect ?? 0),
      costsIndirectRealized: new Prisma.Decimal(r.costsIndirect ?? 0),
      costsProjected:
        p.costsTotal != null ? new Prisma.Decimal(p.costsTotal) : null,
      grossMarginRealized: new Prisma.Decimal(r.grossMargin ?? 0),
      netMarginRealized: new Prisma.Decimal(r.netMargin ?? 0),
      netMarginPctRealized:
        r.netMarginPct != null ? new Prisma.Decimal(r.netMarginPct) : null,
      costPerKgRealized:
        r.costPerKg != null ? new Prisma.Decimal(r.costPerKg) : null,
      costPerKgProjected:
        p.costPerKg != null ? new Prisma.Decimal(p.costPerKg) : null,
      roiRealized:
        r.roi != null ? new Prisma.Decimal(r.roi) : null,
      roiProjected:
        p.roi != null ? new Prisma.Decimal(p.roi) : null,
      icActual:
        r.icActual != null ? new Prisma.Decimal(r.icActual) : null,
      gmqActual:
        r.gmqActual != null ? new Prisma.Decimal(r.gmqActual) : null,
      kgProducedRealized:
        r.kgProduced != null ? new Prisma.Decimal(r.kgProduced) : null,
      kgProjected:
        p.kgProduced != null ? new Prisma.Decimal(p.kgProduced) : null,
      breakevenPricePerKg:
        r.breakevenPricePerKg != null
          ? new Prisma.Decimal(r.breakevenPricePerKg)
          : null,
      isProfitable:
        r.netMargin != null ? r.netMargin > 0 : null,
      dataQuality: result.dataQuality,
      detailJson: {
        vsTargets: result.vsTargets,
        warnings: result.warnings,
        animalsSold: result.animalsSold,
        animalsRemaining: result.animalsRemaining
      }
    },
    update: {
      snapshotDate: new Date(),
      status: result.status === "closed" ? "closed" : "open",
      revenuesRealized: new Prisma.Decimal(r.revenues ?? 0),
      revenuesProjected:
        p.revenues != null ? new Prisma.Decimal(p.revenues) : null,
      costsDirectRealized: new Prisma.Decimal(r.costsDirect ?? 0),
      costsIndirectRealized: new Prisma.Decimal(r.costsIndirect ?? 0),
      costsProjected:
        p.costsTotal != null ? new Prisma.Decimal(p.costsTotal) : null,
      grossMarginRealized: new Prisma.Decimal(r.grossMargin ?? 0),
      netMarginRealized: new Prisma.Decimal(r.netMargin ?? 0),
      netMarginPctRealized:
        r.netMarginPct != null ? new Prisma.Decimal(r.netMarginPct) : null,
      costPerKgRealized:
        r.costPerKg != null ? new Prisma.Decimal(r.costPerKg) : null,
      costPerKgProjected:
        p.costPerKg != null ? new Prisma.Decimal(p.costPerKg) : null,
      roiRealized:
        r.roi != null ? new Prisma.Decimal(r.roi) : null,
      roiProjected:
        p.roi != null ? new Prisma.Decimal(p.roi) : null,
      icActual:
        r.icActual != null ? new Prisma.Decimal(r.icActual) : null,
      gmqActual:
        r.gmqActual != null ? new Prisma.Decimal(r.gmqActual) : null,
      kgProducedRealized:
        r.kgProduced != null ? new Prisma.Decimal(r.kgProduced) : null,
      kgProjected:
        p.kgProduced != null ? new Prisma.Decimal(p.kgProduced) : null,
      breakevenPricePerKg:
        r.breakevenPricePerKg != null
          ? new Prisma.Decimal(r.breakevenPricePerKg)
          : null,
      isProfitable:
        r.netMargin != null ? r.netMargin > 0 : null,
      dataQuality: result.dataQuality,
      detailJson: {
        vsTargets: result.vsTargets,
        warnings: result.warnings,
        animalsSold: result.animalsSold,
        animalsRemaining: result.animalsRemaining
      }
    }
  });
}
