import {
  AnimalProductionCategory,
  FeedMovementKind,
  FeedProductionPhase,
  FinanceCategoryType,
  PenCategory,
  Prisma
} from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import type {
  CostBreakdownRow,
  FeedCostByPhase,
  IcByPhasePayload,
  IcPhaseResult,
  ProductionPhaseKey,
  ProfitabilityPeriodResult
} from "./profitability.types";

const FIXED_COST_KEYS = ["labor", "infrastructure"] as const;

const PHASE_LABELS: Record<ProductionPhaseKey, string> = {
  starter: "Démarrage",
  growth: "Croissance",
  fattening: "Engraissement"
};

const COLORS: Record<string, string> = {
  feed_starter: "#4ECDC4",
  feed_growth: "#45B7D1",
  feed_fattening: "#2B7FFF",
  feed_breeder: "#96CEB4",
  health: "#FF6B6B",
  fixed: "#DDA0DD",
  other: "#FFEAA7"
};

type MonthRef = { year: number; month: number };

function monthRange(ref: MonthRef) {
  return {
    start: new Date(Date.UTC(ref.year, ref.month - 1, 1)),
    end: new Date(Date.UTC(ref.year, ref.month, 1))
  };
}

function dec(n: number) {
  return new Prisma.Decimal(n);
}

function num(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  const v = Number(d.toString());
  return Number.isFinite(v) ? v : 0;
}

function icStatus(ic: number | null, target: number): IcPhaseResult["status"] {
  if (ic == null || !Number.isFinite(ic) || ic <= 0) return "unavailable";
  if (ic <= target) return "ok";
  if (ic <= target + 0.5) return "warning";
  return "critical";
}

function mapPenPhase(
  category: PenCategory | null,
  batchTag: "starter" | "fattening" | null
): ProductionPhaseKey | null {
  if (
    category === PenCategory.maternity ||
    category === PenCategory.quarantine ||
    category === PenCategory.empty
  ) {
    return null;
  }
  if (category === PenCategory.starter || batchTag === "starter") return "starter";
  if (category === PenCategory.fattening || batchTag === "fattening") {
    return "fattening";
  }
  if (category === PenCategory.mixed) return null;
  return "growth";
}

function mapBatchTag(key: string | null | undefined): "starter" | "fattening" | null {
  const k = (key ?? "").toLowerCase();
  if (
    k.includes("nursery") ||
    k.includes("demarrage") ||
    k === "starter" ||
    k.includes("porcelet")
  ) {
    return "starter";
  }
  if (k.includes("finish") || k.includes("engrais") || k === "finisher") {
    return "fattening";
  }
  return null;
}

function allocUnknownFeed(cost: number, target: FeedCostByPhase) {
  target.starter += cost * 0.33;
  target.growth += cost * 0.34;
  target.fattening += cost * 0.33;
}

export class ProfitabilityEngine {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSettings(farmId: string) {
    return this.prisma.farmProfitabilitySettings.upsert({
      where: { farmId },
      create: { farmId },
      update: {}
    });
  }

  async calculatePeriod(
    farmId: string,
    ref: MonthRef,
    persistSnapshot = true
  ): Promise<ProfitabilityPeriodResult> {
    const settings = await this.ensureSettings(farmId);
    const financeSettings = await this.prisma.farmFinanceSettings.findUnique({
      where: { farmId }
    });
    const currency = financeSettings?.currencyCode ?? "XOF";
    const currencySymbol = financeSettings?.currencySymbol ?? "FCFA";
    const { start, end } = monthRange(ref);

    const [feedTypes, feedMovements, expenses, revenues, pensData, soldAnimals, litters] =
      await Promise.all([
        this.prisma.feedType.findMany({ where: { farmId } }),
        this.prisma.feedStockMovement.findMany({
          where: { farmId, occurredAt: { gte: start, lt: end } },
          include: {
            feedType: { select: { productionPhase: true, weightPerBagKg: true } }
          }
        }),
        this.prisma.farmExpense.findMany({
          where: { farmId, occurredAt: { gte: start, lt: end } },
          include: { financeCategory: { select: { key: true } } }
        }),
        this.prisma.farmRevenue.findMany({
          where: { farmId, occurredAt: { gte: start, lt: end } },
          include: { financeCategory: { select: { key: true } } }
        }),
        this.loadPenData(farmId, settings),
        this.prisma.animal.findMany({
          where: {
            farmId,
            soldAt: { gte: start, lt: end },
            soldWeightKg: { not: null }
          },
          select: { soldWeightKg: true, soldPrice: true }
        }),
        this.prisma.litter.count({
          where: { farmId, recordedAt: { gte: start, lt: end } }
        })
      ]);

    const feedCost: FeedCostByPhase = {
      starter: 0,
      growth: 0,
      fattening: 0,
      breeder: 0
    };
    const feedKg: Record<ProductionPhaseKey | "breeder", number> = {
      starter: 0,
      growth: 0,
      fattening: 0,
      breeder: 0
    };

    for (const m of feedMovements) {
      const phase = m.feedType.productionPhase;
      if (m.kind === FeedMovementKind.in) {
        const cost = num(m.quantityKg) * num(m.unitPrice);
        if (phase === FeedProductionPhase.starter) feedCost.starter += cost;
        else if (phase === FeedProductionPhase.growth) feedCost.growth += cost;
        else if (phase === FeedProductionPhase.fattening) feedCost.fattening += cost;
        else if (phase === FeedProductionPhase.breeder) feedCost.breeder += cost;
        else allocUnknownFeed(cost, feedCost);
      }
      if (m.kind === FeedMovementKind.stock_check) {
        const kg = num(m.bagsConsumed) * num(m.feedType.weightPerBagKg);
        if (phase === FeedProductionPhase.starter) feedKg.starter += kg;
        else if (phase === FeedProductionPhase.growth) feedKg.growth += kg;
        else if (phase === FeedProductionPhase.fattening) feedKg.fattening += kg;
        else if (phase === FeedProductionPhase.breeder) feedKg.breeder += kg;
      }
    }

    let healthCost = 0;
    let fixedCosts = 0;
    let otherCosts = 0;
    let feedExpenseFallback = 0;

    for (const e of expenses) {
      const key = e.financeCategory?.key ?? e.category ?? "";
      const amt = num(e.amount);
      if (key === "health") healthCost += amt;
      else if (key === "feed") feedExpenseFallback += amt;
      else if ((FIXED_COST_KEYS as readonly string[]).includes(key)) {
        fixedCosts += amt;
      } else if (key !== "feed") {
        otherCosts += amt;
      }
    }

    const feedFromMoves =
      feedCost.starter + feedCost.growth + feedCost.fattening + feedCost.breeder;
    if (feedFromMoves <= 0 && feedExpenseFallback > 0) {
      allocUnknownFeed(feedExpenseFallback, feedCost);
    }

    const breederHealth = await this.breederHealthCost(farmId, start, end);
    const breederImputed =
      litters > 0 ? (feedCost.breeder + breederHealth) / litters : 0;

    const totalCosts = expenses.reduce((s, e) => s + num(e.amount), 0);

    const kgSold = soldAnimals.reduce((s, a) => s + num(a.soldWeightKg), 0);
    let saleTotal = 0;
    for (const a of soldAnimals) saleTotal += num(a.soldPrice);
    let avgSale =
      kgSold > 0 ? saleTotal / kgSold : null;
    if (avgSale == null) {
      let revSales = 0;
      for (const r of revenues) {
        if (r.financeCategory?.key === "animal_sales") revSales += num(r.amount);
      }
      avgSale = kgSold > 0 && revSales > 0 ? revSales / kgSold : null;
    }

    const targets = {
      starter: num(settings.icTargetStarter),
      growth: num(settings.icTargetGrowth),
      fattening: num(settings.icTargetFattening)
    };
    const icByPhase = this.buildIc(
      feedKg,
      pensData.kgGained,
      pensData.kgGainedLabels,
      targets,
      feedTypes.every((f) => f.productionPhase !== FeedProductionPhase.unknown)
    );

    const costPerKgSold = kgSold > 0 ? totalCosts / kgSold : null;
    const kgProd = kgSold + pensData.kgEstimated;
    const costPerKgProduced = kgProd > 0 ? totalCosts / kgProd : null;
    const marginPerKg =
      costPerKgSold != null && avgSale != null ? avgSale - costPerKgSold : null;
    const market = settings.marketPricePerKg ? num(settings.marketPricePerKg) : null;
    const herdValue =
      market != null && pensData.kgEstimated > 0
        ? pensData.kgEstimated * market
        : null;

    const result: ProfitabilityPeriodResult = {
      farmId,
      periodMonth: ref.month,
      periodYear: ref.year,
      currency,
      currencySymbol,
      settings: {
        marketPricePerKg: market,
        icTargetStarter: targets.starter,
        icTargetGrowth: targets.growth,
        icTargetFattening: targets.fattening,
        gmqRefStarter: settings.gmqRefStarter,
        gmqRefGrowth: settings.gmqRefGrowth,
        gmqRefFattening: settings.gmqRefFattening
      },
      totalCosts,
      feedCostByPhase: feedCost,
      healthCost,
      fixedCosts,
      breederCostImputed: breederImputed,
      otherCosts,
      kgSoldReal: kgSold,
      kgSoldLabel: "Données réelles ✅",
      kgEstimatedInStock: pensData.kgEstimated,
      kgEstimatedLabel: pensData.estLabel,
      avgSalePricePerKg: avgSale,
      costPerKgSold,
      costPerKgProduced,
      marginPerKg,
      breakEvenPricePerKg: costPerKgSold,
      isProfitable: marginPerKg != null ? marginPerKg >= 0 : null,
      herdValueEstimated: herdValue,
      icByPhase,
      costBreakdown: this.breakdown(
        feedCost,
        healthCost,
        fixedCosts,
        breederImputed,
        otherCosts,
        totalCosts,
        kgSold
      ),
      calculatedAt: new Date().toISOString(),
      snapshotId: null
    };

    if (persistSnapshot) {
      const snap = await this.prisma.profitabilitySnapshot.upsert({
        where: {
          farmId_periodYear_periodMonth: {
            farmId,
            periodYear: ref.year,
            periodMonth: ref.month
          }
        },
        create: {
          farmId,
          periodMonth: ref.month,
          periodYear: ref.year,
          totalCosts: dec(totalCosts),
          feedCostByPhase: feedCost as unknown as Prisma.InputJsonValue,
          healthCost: dec(healthCost),
          fixedCosts: dec(fixedCosts),
          breederCostImputed: dec(breederImputed),
          otherCosts: dec(otherCosts),
          kgSoldReal: dec(kgSold),
          kgEstimatedInStock: dec(pensData.kgEstimated),
          avgSalePricePerKg: avgSale != null ? dec(avgSale) : null,
          costPerKgSold: costPerKgSold != null ? dec(costPerKgSold) : null,
          costPerKgProduced:
            costPerKgProduced != null ? dec(costPerKgProduced) : null,
          marginPerKg: marginPerKg != null ? dec(marginPerKg) : null,
          icByPhase: icByPhase as unknown as Prisma.InputJsonValue,
          herdValueEstimated: herdValue != null ? dec(herdValue) : null
        },
        update: {
          totalCosts: dec(totalCosts),
          feedCostByPhase: feedCost as unknown as Prisma.InputJsonValue,
          healthCost: dec(healthCost),
          fixedCosts: dec(fixedCosts),
          breederCostImputed: dec(breederImputed),
          otherCosts: dec(otherCosts),
          kgSoldReal: dec(kgSold),
          kgEstimatedInStock: dec(pensData.kgEstimated),
          avgSalePricePerKg: avgSale != null ? dec(avgSale) : null,
          costPerKgSold: costPerKgSold != null ? dec(costPerKgSold) : null,
          costPerKgProduced:
            costPerKgProduced != null ? dec(costPerKgProduced) : null,
          marginPerKg: marginPerKg != null ? dec(marginPerKg) : null,
          icByPhase: icByPhase as unknown as Prisma.InputJsonValue,
          herdValueEstimated: herdValue != null ? dec(herdValue) : null,
          calculatedAt: new Date()
        }
      });
      result.snapshotId = snap.id;
    }

    return result;
  }

  private async breederHealthCost(farmId: string, start: Date, end: Date) {
    const healthCat = await this.prisma.financeCategory.findFirst({
      where: { farmId, key: "health", type: FinanceCategoryType.expense }
    });
    if (!healthCat) return 0;
    const breeders = await this.prisma.animal.findMany({
      where: {
        farmId,
        productionCategory: {
          in: [
            AnimalProductionCategory.breeding_female,
            AnimalProductionCategory.breeding_male
          ]
        }
      },
      select: { id: true }
    });
    if (breeders.length === 0) return 0;
    const rows = await this.prisma.farmExpense.findMany({
      where: {
        farmId,
        financeCategoryId: healthCat.id,
        occurredAt: { gte: start, lt: end },
        linkedEntityType: "animal",
        linkedEntityId: { in: breeders.map((b) => b.id) }
      },
      select: { amount: true }
    });
    return rows.reduce((s, r) => s + num(r.amount), 0);
  }

  private async loadPenData(
    farmId: string,
    settings: { gmqRefStarter: number; gmqRefGrowth: number; gmqRefFattening: number }
  ) {
    const pens = await this.prisma.pen.findMany({
      where: { barn: { farmId }, status: "active" },
      include: {
        placements: {
          where: { endedAt: null },
          include: {
            animal: {
              select: {
                productionCategory: true,
                entryWeightKg: true,
                weights: { orderBy: { measuredAt: "desc" }, take: 1 }
              }
            },
            batch: {
              select: {
                categoryKey: true,
                headcount: true,
                weights: { orderBy: { measuredAt: "desc" }, take: 1 }
              }
            }
          }
        }
      }
    });

    let kgEstimated = 0;
    let estLabel = "Estimation depuis poids moyen loges";
    const kgGained: Record<ProductionPhaseKey, number> = {
      starter: 0,
      growth: 0,
      fattening: 0
    };
    const kgGainedLabels: Record<ProductionPhaseKey, string> = {
      starter: estLabel,
      growth: estLabel,
      fattening: estLabel
    };

    for (const pen of pens) {
      let occ = 0;
      let batchTag: "starter" | "fattening" | null = null;
      let skip = false;

      for (const pl of pen.placements) {
        if (
          pl.animal?.productionCategory ===
            AnimalProductionCategory.breeding_female ||
          pl.animal?.productionCategory === AnimalProductionCategory.breeding_male
        ) {
          skip = true;
        }
        if (pl.animal && !skip) occ += 1;
        if (pl.batch) {
          const t = mapBatchTag(pl.batch.categoryKey);
          if (t) batchTag = t;
          occ += pl.batch.headcount;
        }
      }
      if (skip && occ === 0) continue;
      if (occ <= 0) continue;

      const phase = mapPenPhase(pen.category, batchTag);
      if (!phase) continue;

      let penKg = 0;
      let entry = 7;

      if (pen.averageWeightKg && num(pen.averageWeightKg) > 0) {
        penKg = num(pen.averageWeightKg) * occ;
      } else {
        let wSum = 0;
        for (const pl of pen.placements) {
          if (pl.animal?.weights[0]) wSum += num(pl.animal.weights[0].weightKg);
          if (pl.batch?.weights[0]) {
            wSum += num(pl.batch.weights[0].avgWeightKg) * pl.batch.headcount;
          }
          if (pl.animal?.entryWeightKg) entry = num(pl.animal.entryWeightKg);
        }
        if (wSum > 0) {
          penKg = wSum;
          estLabel = "Estimation depuis dernières pesées";
          kgGainedLabels[phase] = estLabel;
        } else {
          const gmq =
            phase === "starter"
              ? settings.gmqRefStarter
              : phase === "growth"
                ? settings.gmqRefGrowth
                : settings.gmqRefFattening;
          const days = pen.averageAgeDays ?? 30;
          penKg = (entry + (gmq * days) / 1000) * occ;
          estLabel = "⚠️ Estimation GMQ — À confirmer";
          kgGainedLabels[phase] = estLabel;
        }
      }

      kgEstimated += penKg;
      const avg = penKg / occ;
      kgGained[phase] += Math.max(0, (avg - entry) * occ);
    }

    return { kgEstimated, estLabel, kgGained, kgGainedLabels };
  }

  private buildIc(
    feedKg: Record<ProductionPhaseKey | "breeder", number>,
    kgGained: Record<ProductionPhaseKey, number>,
    labels: Record<ProductionPhaseKey, string>,
    targets: Record<ProductionPhaseKey, number>,
    allQualified: boolean
  ): IcByPhasePayload {
    const phases: ProductionPhaseKey[] = ["starter", "growth", "fattening"];
    const out = {} as Record<ProductionPhaseKey, IcPhaseResult>;
    let tFeed = 0;
    let tGain = 0;

    for (const p of phases) {
      const consumed = feedKg[p];
      const gained = kgGained[p];
      tFeed += consumed;
      tGain += gained;
      const ic = gained > 0 && consumed > 0 ? consumed / gained : null;
      out[p] = {
        phase: p,
        label: PHASE_LABELS[p],
        icCalculated: ic,
        icTarget: targets[p],
        status: icStatus(ic, targets[p]),
        feedConsumedKg: consumed,
        kgGained: gained,
        kgGainedLabel: labels[p],
        dataSource: labels[p].includes("GMQ") ? "estimated" : "real"
      };
    }

    return {
      starter: out.starter,
      growth: out.growth,
      fattening: out.fattening,
      global: {
        icCalculated: tGain > 0 && tFeed > 0 ? tFeed / tGain : null,
        feedConsumedKg: tFeed,
        kgGained: tGain,
        note: "Indicateur global — les IC par phase pilotent la performance"
      },
      allFeedTypesQualified: allQualified
    };
  }

  private breakdown(
    feed: FeedCostByPhase,
    health: number,
    fixed: number,
    breeder: number,
    other: number,
    total: number,
    kgSold: number
  ): CostBreakdownRow[] {
    const row = (
      key: string,
      label: string,
      amount: number,
      color: string
    ): CostBreakdownRow => ({
      key,
      label,
      amount,
      pctOfTotal: total > 0 ? (amount / total) * 100 : 0,
      costPerKg: kgSold > 0 ? amount / kgSold : null,
      color
    });
    return [
      row("feed_starter", "Aliment démarrage", feed.starter, COLORS.feed_starter),
      row("feed_growth", "Aliment croissance", feed.growth, COLORS.feed_growth),
      row(
        "feed_fattening",
        "Aliment engraissement",
        feed.fattening,
        COLORS.feed_fattening
      ),
      row(
        "feed_breeder",
        "Aliment reproducteurs (imputé)",
        feed.breeder + breeder,
        COLORS.feed_breeder
      ),
      row("health", "Santé", health, COLORS.health),
      row("fixed", "Charges fixes", fixed, COLORS.fixed),
      row("other", "Autres", other, COLORS.other)
    ].filter((r) => r.amount > 0.01 || r.key === "fixed");
  }

  async getHistory(farmId: string, months: number) {
    const snaps = await this.prisma.profitabilitySnapshot.findMany({
      where: { farmId },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      take: months
    });
    return [...snaps].reverse().map((s) => ({
      periodMonth: s.periodMonth,
      periodYear: s.periodYear,
      monthKey: `${s.periodYear}-${String(s.periodMonth).padStart(2, "0")}`,
      costPerKgSold: s.costPerKgSold ? num(s.costPerKgSold) : null,
      salePricePerKg: s.avgSalePricePerKg ? num(s.avgSalePricePerKg) : null,
      breakEvenPricePerKg: s.costPerKgSold ? num(s.costPerKgSold) : null,
      marginPerKg: s.marginPerKg ? num(s.marginPerKg) : null,
      totalCosts: num(s.totalCosts)
    }));
  }

  simulate(
    base: ProfitabilityPeriodResult,
    param: string,
    value: number
  ) {
    let totalCosts = base.totalCosts;
    let avgSale = base.avgSalePricePerKg ?? 0;
    let feedSavings: number | null = null;
    let message = "";

    if (param === "sale_price") {
      avgSale = value;
      message = `Prix vente simulé : ${value}`;
    } else if (param === "ic_improvement_pct") {
      const pct = Math.max(0, Math.min(100, value));
      const feedTotal =
        base.feedCostByPhase.starter +
        base.feedCostByPhase.growth +
        base.feedCostByPhase.fattening +
        base.feedCostByPhase.breeder;
      feedSavings = feedTotal * (pct / 100);
      totalCosts -= feedSavings;
      message = `Amélioration IC de ${pct}%`;
    } else if (param === "headcount_delta") {
      const dilution = base.fixedCosts * 0.05 * value;
      totalCosts = Math.max(0, totalCosts - dilution);
      message = `Effectif ${value >= 0 ? "+" : ""}${value}`;
    }

    const costPerKgSold =
      base.kgSoldReal > 0 ? totalCosts / base.kgSoldReal : null;
    const marginPerKg =
      costPerKgSold != null && avgSale > 0 ? avgSale - costPerKgSold : null;

    return {
      param,
      value,
      costPerKgSold,
      marginPerKg,
      isProfitable: marginPerKg != null ? marginPerKg >= 0 : null,
      herdValueEstimated: base.herdValueEstimated,
      feedSavingsEstimate: feedSavings,
      message
    };
  }
}
