import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  COST_BREAKDOWN_LABELS,
  DIRECT_EXPENSE_CATEGORY_KEYS,
  INDIRECT_EXPENSE_CATEGORY_KEYS
} from "./profitability.constants";
import { dec, pct, resolvePeriodBounds, safeDiv } from "./profitability-period.util";
import type {
  CostBreakdownItem,
  FarmProfitabilityResult,
  MonthlyRevCostPoint,
  ProfitabilityDataQuality,
  ProfitabilityMetrics,
  ProfitabilityPeriodKey
} from "./profitability.types";

type CategoryMap = Map<string, { key: string; type: string }>;

function emptyMetrics(): ProfitabilityMetrics {
  return {
    grossMargin: null,
    grossMarginPct: null,
    netMargin: null,
    netMarginPct: null,
    costPerKg: null,
    roi: null,
    breakevenPricePerKg: null,
    revenues: null,
    costsDirect: null,
    costsIndirect: null,
    costsTotal: null,
    kgProduced: null
  };
}

function buildMetrics(params: {
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

function resolveDataQuality(params: {
  hasRevenues: boolean;
  hasCosts: boolean;
  hasKg: boolean;
}): { quality: ProfitabilityDataQuality; message: string | null } {
  if (!params.hasRevenues && !params.hasCosts) {
    return {
      quality: "insufficient",
      message:
        "Pas encore assez de transactions enregistrées pour calculer la rentabilité."
    };
  }
  if (!params.hasRevenues) {
    return {
      quality: "partial",
      message:
        "Coûts enregistrés mais aucune vente sur la période — marge non calculable."
    };
  }
  if (!params.hasCosts) {
    return {
      quality: "partial",
      message:
        "Revenus enregistrés mais coûts incomplets — vérifiez vos dépenses."
    };
  }
  if (!params.hasKg) {
    return {
      quality: "partial",
      message:
        "Marge calculée sans poids vendu — coût/kg et seuil de rentabilité indisponibles."
    };
  }
  return { quality: "sufficient", message: null };
}

async function loadCategoryMap(
  prisma: PrismaClient,
  farmId: string
): Promise<CategoryMap> {
  const rows = await prisma.financeCategory.findMany({
    where: { farmId },
    select: { id: true, key: true, type: true }
  });
  return new Map(rows.map((r) => [r.id, { key: r.key, type: r.type }]));
}

async function sumExpensesByCategoryKey(
  prisma: PrismaClient,
  farmId: string,
  bounds: { start: Date; end: Date },
  categoryMap: CategoryMap
): Promise<Map<string, number>> {
  const rows = await prisma.farmExpense.findMany({
    where: {
      farmId,
      occurredAt: { gte: bounds.start, lt: bounds.end }
    },
    select: { amount: true, financeCategoryId: true }
  });
  const totals = new Map<string, number>();
  for (const row of rows) {
    const cat = row.financeCategoryId
      ? categoryMap.get(row.financeCategoryId)
      : undefined;
    const key = cat?.key ?? "other";
    totals.set(key, (totals.get(key) ?? 0) + dec(row.amount));
  }
  return totals;
}

async function sumRevenues(
  prisma: PrismaClient,
  farmId: string,
  bounds: { start: Date; end: Date }
): Promise<number> {
  const agg = await prisma.farmRevenue.aggregate({
    where: {
      farmId,
      occurredAt: { gte: bounds.start, lt: bounds.end }
    },
    _sum: { amount: true }
  });
  return dec(agg._sum.amount);
}

async function sumKgSold(
  prisma: PrismaClient,
  farmId: string,
  bounds: { start: Date; end: Date }
): Promise<number> {
  const exits = await prisma.livestockExit.findMany({
    where: {
      farmId,
      kind: "sale",
      occurredAt: { gte: bounds.start, lt: bounds.end }
    },
    select: { weightKg: true, headcountAffected: true }
  });
  let kg = 0;
  for (const e of exits) {
    if (e.weightKg != null && dec(e.weightKg) > 0) {
      kg += dec(e.weightKg);
    } else if (e.headcountAffected != null && e.headcountAffected > 0) {
      // Poids inconnu — ne pas inventer
      continue;
    }
  }
  return kg;
}

async function estimateKgProjected(
  prisma: PrismaClient,
  farmId: string
): Promise<number | null> {
  const animals = await prisma.animal.findMany({
    where: { farmId, status: "active" },
    select: {
      weights: {
        orderBy: { measuredAt: "desc" },
        take: 1,
        select: { weightKg: true }
      }
    }
  });
  if (!animals.length) {
    return null;
  }
  let total = 0;
  let known = 0;
  for (const a of animals) {
    const w = a.weights[0]?.weightKg;
    if (w != null && dec(w) > 0) {
      total += dec(w);
      known += 1;
    }
  }
  if (known === 0) {
    return null;
  }
  return total;
}

async function loadProjectedFromPredictions(
  prisma: PrismaClient,
  farmId: string
): Promise<{ revenue: number | null; costs: number | null }> {
  const row = await prisma.farmPrediction.findUnique({ where: { farmId } });
  if (!row?.predictionsJson) {
    return { revenue: null, costs: null };
  }
  const json = row.predictionsJson as {
    finance_predictions?: {
      revenue_estimates?: { "30j"?: { amount?: number } };
      expense_projections?: { "30j"?: { total?: number } };
    };
  };
  const rev = json.finance_predictions?.revenue_estimates?.["30j"]?.amount;
  const costs = json.finance_predictions?.expense_projections?.["30j"]?.total;
  return {
    revenue: rev != null && Number.isFinite(rev) ? rev : null,
    costs: costs != null && Number.isFinite(costs) ? costs : null
  };
}

async function buildMonthlySeries(
  prisma: PrismaClient,
  farmId: string,
  months: number
): Promise<MonthlyRevCostPoint[]> {
  const now = new Date();
  const points: MonthlyRevCostPoint[] = [];
  const categoryMap = await loadCategoryMap(prisma, farmId);

  for (let i = months - 1; i >= 0; i -= 1) {
    const ref = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    const start = ref;
    const end = new Date(
      Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1)
    );
    const [revenues, expenseByKey] = await Promise.all([
      sumRevenues(prisma, farmId, { start, end }),
      sumExpensesByCategoryKey(prisma, farmId, { start, end }, categoryMap)
    ]);
    let costsTotal = 0;
    for (const amt of expenseByKey.values()) {
      costsTotal += amt;
    }
    points.push({
      month: start.toISOString().slice(0, 7),
      revenuesRealized: revenues,
      costsTotal,
      netMargin: revenues - costsTotal
    });
  }
  return points;
}

function splitCosts(expenseByKey: Map<string, number>): {
  direct: number;
  indirect: number;
  breakdown: CostBreakdownItem[];
} {
  let direct = 0;
  let indirect = 0;
  const breakdown: CostBreakdownItem[] = [];
  let total = 0;
  for (const amt of expenseByKey.values()) {
    total += amt;
  }
  for (const [key, amount] of expenseByKey.entries()) {
    if (amount <= 0) continue;
    if (DIRECT_EXPENSE_CATEGORY_KEYS.has(key)) {
      direct += amount;
    } else if (
      INDIRECT_EXPENSE_CATEGORY_KEYS.has(key) ||
      !DIRECT_EXPENSE_CATEGORY_KEYS.has(key)
    ) {
      indirect += amount;
    }
    breakdown.push({
      key,
      label: COST_BREAKDOWN_LABELS[key] ?? key,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0
    });
  }
  breakdown.sort((a, b) => b.amount - a.amount);
  return { direct, indirect, breakdown };
}

export async function calculateFarmProfitability(
  prisma: PrismaClient,
  farmId: string,
  period: ProfitabilityPeriodKey,
  custom?: { start: string; end: string }
): Promise<FarmProfitabilityResult> {
  const bounds = resolvePeriodBounds(period, custom);
  const [categoryMap, settings, profitabilitySettings, projectedPred] =
    await Promise.all([
      loadCategoryMap(prisma, farmId),
      prisma.farmFinanceSettings.findUnique({ where: { farmId } }),
      prisma.farmProfitabilitySettings.findUnique({ where: { farmId } }),
      loadProjectedFromPredictions(prisma, farmId)
    ]);

  const currency = settings?.currencyCode ?? "XOF";
  const marketPricePerKg = profitabilitySettings?.marketPricePerKg
    ? dec(profitabilitySettings.marketPricePerKg)
    : null;

  const [expenseByKey, revenuesRealized, kgRealized, kgProjected, monthlySeries] =
    await Promise.all([
      sumExpensesByCategoryKey(prisma, farmId, bounds, categoryMap),
      sumRevenues(prisma, farmId, bounds),
      sumKgSold(prisma, farmId, bounds),
      estimateKgProjected(prisma, farmId),
      buildMonthlySeries(prisma, farmId, 6)
    ]);

  const { direct, indirect, breakdown } = splitCosts(expenseByKey);
  const realized = buildMetrics({
    revenues: revenuesRealized,
    costsDirect: direct,
    costsIndirect: indirect,
    kgProduced: kgRealized > 0 ? kgRealized : null
  });

  let projectedRevenues = projectedPred.revenue;
  let projectedCosts = projectedPred.costs;
  if (projectedRevenues == null && kgProjected != null && marketPricePerKg) {
    projectedRevenues = kgProjected * marketPricePerKg;
  }
  if (projectedCosts == null && projectedPred.costs == null) {
    projectedCosts = null;
  }

  const projected = buildMetrics({
    revenues: projectedRevenues ?? 0,
    costsDirect: projectedCosts != null ? projectedCosts * 0.7 : 0,
    costsIndirect: projectedCosts != null ? projectedCosts * 0.3 : 0,
    kgProduced: kgProjected
  });

  if (projectedRevenues == null && projectedCosts == null) {
    Object.assign(projected, emptyMetrics());
  }

  const combined = buildMetrics({
    revenues: (realized.revenues ?? 0) + (projected.revenues ?? 0),
    costsDirect: (realized.costsDirect ?? 0) + (projected.costsDirect ?? 0),
    costsIndirect:
      (realized.costsIndirect ?? 0) + (projected.costsIndirect ?? 0),
    kgProduced:
      (realized.kgProduced ?? 0) + (projected.kgProduced ?? 0) || null
  });

  const dataQuality = resolveDataQuality({
    hasRevenues: revenuesRealized > 0,
    hasCosts: direct + indirect > 0,
    hasKg: kgRealized > 0 || kgProjected != null
  });

  const prevBounds = {
    start: new Date(
      bounds.start.getTime() -
        (bounds.end.getTime() - bounds.start.getTime())
    ),
    end: bounds.start
  };
  const [prevRev, prevExpMap] = await Promise.all([
    sumRevenues(prisma, farmId, prevBounds),
    sumExpensesByCategoryKey(prisma, farmId, prevBounds, categoryMap)
  ]);
  const prevSplit = splitCosts(prevExpMap);
  const prevNet = prevRev - prevSplit.direct - prevSplit.indirect;
  const prevNetPct = pct(prevNet, prevRev);
  const curNetPct = realized.netMarginPct;

  return {
    farmId,
    period,
    periodStart: bounds.start.toISOString(),
    periodEnd: bounds.end.toISOString(),
    currency,
    marketPricePerKg,
    dataQuality: dataQuality.quality,
    dataQualityMessage: dataQuality.message,
    realized,
    projected,
    combined,
    costBreakdown: breakdown,
    monthlySeries,
    trendVsPreviousPeriod: {
      netMarginPctDelta:
        curNetPct != null && prevNetPct != null
          ? curNetPct - prevNetPct
          : null,
      grossMarginPctDelta: null
    },
    snapshotAt: new Date().toISOString()
  };
}

export async function persistFarmSnapshot(
  prisma: PrismaClient,
  result: FarmProfitabilityResult
): Promise<void> {
  const r = result.realized;
  const p = result.projected;
  await prisma.farmProfitabilitySnapshot.upsert({
    where: {
      farmId_period: { farmId: result.farmId, period: result.period }
    },
    create: {
      farmId: result.farmId,
      period: result.period,
      grossMarginRealized: new Prisma.Decimal(r.grossMargin ?? 0),
      grossMarginPct:
        r.grossMarginPct != null
          ? new Prisma.Decimal(r.grossMarginPct)
          : null,
      netMarginRealized: new Prisma.Decimal(r.netMargin ?? 0),
      netMarginPct:
        r.netMarginPct != null ? new Prisma.Decimal(r.netMarginPct) : null,
      costPerKgRealized:
        r.costPerKg != null ? new Prisma.Decimal(r.costPerKg) : null,
      costPerKgProjected:
        p.costPerKg != null ? new Prisma.Decimal(p.costPerKg) : null,
      roiRealized:
        r.roi != null ? new Prisma.Decimal(r.roi) : null,
      roiProjected:
        p.roi != null ? new Prisma.Decimal(p.roi) : null,
      breakevenPricePerKg:
        r.breakevenPricePerKg != null
          ? new Prisma.Decimal(r.breakevenPricePerKg)
          : null,
      revenuesRealized: new Prisma.Decimal(r.revenues ?? 0),
      revenuesProjected:
        p.revenues != null ? new Prisma.Decimal(p.revenues) : null,
      costsDirectRealized: new Prisma.Decimal(r.costsDirect ?? 0),
      costsIndirectRealized: new Prisma.Decimal(r.costsIndirect ?? 0),
      costsProjected:
        p.costsTotal != null ? new Prisma.Decimal(p.costsTotal) : null,
      grossMarginProjected:
        p.grossMargin != null ? new Prisma.Decimal(p.grossMargin) : null,
      netMarginProjected:
        p.netMargin != null ? new Prisma.Decimal(p.netMargin) : null,
      kgProducedRealized:
        r.kgProduced != null ? new Prisma.Decimal(r.kgProduced) : null,
      kgProjected:
        p.kgProduced != null ? new Prisma.Decimal(p.kgProduced) : null,
      marketPricePerKg:
        result.marketPricePerKg != null
          ? new Prisma.Decimal(result.marketPricePerKg)
          : null,
      dataQuality: result.dataQuality,
      detailJson: {
        costBreakdown: result.costBreakdown,
        monthlySeries: result.monthlySeries,
        trend: result.trendVsPreviousPeriod
      }
    },
    update: {
      snapshotDate: new Date(),
      grossMarginRealized: new Prisma.Decimal(r.grossMargin ?? 0),
      grossMarginPct:
        r.grossMarginPct != null
          ? new Prisma.Decimal(r.grossMarginPct)
          : null,
      netMarginRealized: new Prisma.Decimal(r.netMargin ?? 0),
      netMarginPct:
        r.netMarginPct != null ? new Prisma.Decimal(r.netMarginPct) : null,
      costPerKgRealized:
        r.costPerKg != null ? new Prisma.Decimal(r.costPerKg) : null,
      costPerKgProjected:
        p.costPerKg != null ? new Prisma.Decimal(p.costPerKg) : null,
      roiRealized:
        r.roi != null ? new Prisma.Decimal(r.roi) : null,
      roiProjected:
        p.roi != null ? new Prisma.Decimal(p.roi) : null,
      breakevenPricePerKg:
        r.breakevenPricePerKg != null
          ? new Prisma.Decimal(r.breakevenPricePerKg)
          : null,
      revenuesRealized: new Prisma.Decimal(r.revenues ?? 0),
      revenuesProjected:
        p.revenues != null ? new Prisma.Decimal(p.revenues) : null,
      costsDirectRealized: new Prisma.Decimal(r.costsDirect ?? 0),
      costsIndirectRealized: new Prisma.Decimal(r.costsIndirect ?? 0),
      costsProjected:
        p.costsTotal != null ? new Prisma.Decimal(p.costsTotal) : null,
      grossMarginProjected:
        p.grossMargin != null ? new Prisma.Decimal(p.grossMargin) : null,
      netMarginProjected:
        p.netMargin != null ? new Prisma.Decimal(p.netMargin) : null,
      kgProducedRealized:
        r.kgProduced != null ? new Prisma.Decimal(r.kgProduced) : null,
      kgProjected:
        p.kgProduced != null ? new Prisma.Decimal(p.kgProduced) : null,
      marketPricePerKg:
        result.marketPricePerKg != null
          ? new Prisma.Decimal(result.marketPricePerKg)
          : null,
      dataQuality: result.dataQuality,
      detailJson: {
        costBreakdown: result.costBreakdown,
        monthlySeries: result.monthlySeries,
        trend: result.trendVsPreviousPeriod
      }
    }
  });
}
