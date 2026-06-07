import { buildFeedStockStatsForFarm } from "../feed-stock/feed-stock-stats.helper";
import {
  AnimalProductionCategory,
  ListingStatus,
  MarketplaceTransactionStatus,
  Prisma
} from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { ACTIVE_ESCROW_STATUSES } from "../marketplace/escrow/transaction.utils";
import type { ScoreBreakdown } from "./reports-score.util";
import { riskLevelLabel } from "./templates/formatters";
import type {
  ReportBankScoring,
  ReportCheptelCategories,
  ReportFeedExtended,
  ReportGestationExtended,
  ReportMarketplaceSection,
  ReportRecommendation
} from "./templates/farm-report.types";

type SectionsSnap = Record<string, unknown>;

export async function buildExtendedReportData(
  prisma: PrismaService,
  farmId: string,
  start: Date,
  end: Date,
  sections: SectionsSnap,
  score: { global: number; breakdown: ScoreBreakdown },
  prevHeadcount: number,
  currentHeadcount: number
): Promise<{
  marketplace: ReportMarketplaceSection;
  recommendations: ReportRecommendation[];
  objectives: string[];
  bankScoring: ReportBankScoring;
  cheptelCategories: ReportCheptelCategories;
  gestationExtended: ReportGestationExtended;
  feedExtended: ReportFeedExtended;
}> {
  const fin = (sections.finance ?? {}) as {
    current?: { totals?: { revenues: string; expenses: string } };
  };
  const rev = Number(fin.current?.totals?.revenues ?? 0);
  const exp = Number(fin.current?.totals?.expenses ?? 0);
  const monthsInPeriod = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (30 * 86400000))
  );

  const byCat = await prisma.animal.groupBy({
    by: ["productionCategory"],
    where: { farmId, status: "active" },
    _count: { _all: true }
  });
  const countCat = (cat: AnimalProductionCategory) =>
    byCat.find((r) => r.productionCategory === cat)?._count._all ?? 0;
  const totalHead = byCat.reduce((s, r) => s + r._count._all, 0);
  const headDelta =
    prevHeadcount > 0
      ? Math.round(((currentHeadcount - prevHeadcount) / prevHeadcount) * 100)
      : null;

  const monthEnd = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0, 23, 59, 59)
  );
  const monthStart = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)
  );
  const upcomingFarrow = await prisma.animal.findMany({
    where: {
      farmId,
      status: "active",
      expectedFarrowingAt: { gte: new Date(), lte: monthEnd }
    },
    select: { tagCode: true, publicId: true, expectedFarrowingAt: true },
    orderBy: { expectedFarrowingAt: "asc" },
    take: 3
  });

  const closedTx = await prisma.marketplaceTransaction.findMany({
    where: {
      status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      closedAt: { gte: start, lt: end },
      listing: { farmId }
    },
    include: {
      listing: { include: { animal: true } },
      offer: true
    },
    orderBy: { closedAt: "desc" },
    take: 20
  });

  let totalSales = 0;
  const categoryMap = new Map<string, { count: number; amount: number }>();
  const topSales: ReportMarketplaceSection["topSales"] = [];
  for (const tx of closedTx) {
    const amount = Number(tx.finalAmount ?? tx.blockedAmount ?? 0);
    totalSales += amount;
    const cat = String(tx.listing.category ?? "Autre");
    const cur = categoryMap.get(cat) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += amount;
    categoryMap.set(cat, cur);
    if (topSales.length < 3) {
      topSales.push({
        animal: tx.listing.title ?? tx.listing.animal?.tagCode ?? tx.listing.animal?.publicId ?? "—",
        weightKg: tx.realWeightKg != null ? Number(tx.realWeightKg) : null,
        price: amount,
        date: (tx.closedAt ?? tx.updatedAt).toISOString()
      });
    }
  }

  const [pendingEscrowAgg, pendingDeliveryCount, unsoldListings] =
    await Promise.all([
      prisma.marketplaceTransaction.aggregate({
        where: {
          listing: { farmId },
          status: { in: ACTIVE_ESCROW_STATUSES }
        },
        _count: { _all: true },
        _sum: { blockedAmount: true }
      }),
      prisma.marketplaceTransaction.count({
        where: {
          listing: { farmId },
          status: MarketplaceTransactionStatus.PICKUP_SCHEDULED
        }
      }),
      prisma.marketplaceListing.findMany({
        where: { farmId, status: ListingStatus.published },
        select: { id: true, totalPrice: true }
      })
    ]);

  const unsoldValue = unsoldListings.reduce(
    (s, l) => s + Number(l.totalPrice ?? 0),
    0
  );

  const totalWeight = closedTx.reduce(
    (s, t) => s + Number(t.realWeightKg ?? t.estimatedWeightKg ?? 0),
    0
  );
  const avgPricePerKg =
    totalWeight > 0 ? Math.round(totalSales / totalWeight) : null;

  const feed = sections.feed as {
    feedCost?: string;
    stockBreakTypes?: number;
  };
  const feedStats = await buildFeedStockStatsForFarm(prisma, farmId, {
    criticalDays: 7,
    warningDays: 15
  });
  const minDays = feedStats.length
    ? Math.min(...feedStats.map((s) => s.daysRemaining ?? 999))
    : null;
  const stockAlertLevel: ReportFeedExtended["stockAlertLevel"] =
    minDays == null
      ? "amber"
      : minDays <= 7
        ? "red"
        : minDays <= 15
          ? "amber"
          : "green";

  const cheptel = sections.cheptel as { salesExits?: number; births?: number };
  const producedKg = Math.max(1, (cheptel.salesExits ?? 0) * 80);
  const feedCostNum = Number(feed.feedCost ?? 0);
  const costPerKgProduced =
    producedKg > 0 && feedCostNum > 0 ? Math.round(feedCostNum / producedKg) : null;

  const alerts = (sections.smartAlertsTop ?? []) as Array<{
    title: string;
    message: string;
    priority: string;
  }>;
  const recommendations: ReportRecommendation[] = alerts.slice(0, 5).map((a) => ({
    icon:
      a.priority === "critical"
        ? "⚠"
        : a.priority === "warning"
          ? "◆"
          : "●",
    title: a.title,
    description: a.message,
    priority:
      a.priority === "critical"
        ? "URGENT"
        : a.priority === "warning"
          ? "IMPORTANT"
          : ("CONSEIL" as const)
  }));

  if (recommendations.length < 3) {
    const health = sections.health as { vaccineOverdueCount?: number; mortalityRate?: number };
    if ((health.vaccineOverdueCount ?? 0) > 0) {
      recommendations.push({
        icon: "💉",
        title: "Rattraper les vaccins en retard",
        description: `${health.vaccineOverdueCount} rappel(s) vaccinal(aux) à planifier.`,
        priority: "IMPORTANT"
      });
    }
    if ((health.mortalityRate ?? 0) > 0.04) {
      recommendations.push({
        icon: "🏥",
        title: "Renforcer le suivi sanitaire",
        description: "Taux de mortalité au-dessus du seuil recommandé.",
        priority: "URGENT"
      });
    }
    if (rev > 0 && exp / rev > 0.85) {
      recommendations.push({
        icon: "💰",
        title: "Optimiser la marge",
        description: "Les dépenses absorbent une part élevée des revenus.",
        priority: "CONSEIL"
      });
    }
  }

  const objectives: string[] = [];
  if ((sections.health as { vaccineCompletionPct?: number | null }).vaccineCompletionPct != null &&
      Number((sections.health as { vaccineCompletionPct?: number }).vaccineCompletionPct) < 80) {
    objectives.push("Atteindre 80 % de couverture vaccinale d'ici la prochaine période.");
  }
  if (score.breakdown.financialHealth.score < 65) {
    objectives.push("Améliorer la marge nette en réduisant les postes de dépenses non essentiels.");
  }
  if ((feed.stockBreakTypes ?? 0) > 0) {
    objectives.push("Réapprovisionner les types d'aliments en rupture imminente.");
  }
  if (objectives.length === 0) {
    objectives.push(
      "Maintenir la traçabilité des saisies pour consolider le score FermierPro.",
      "Poursuivre les ventes marketplace pour diversifier les revenus."
    );
  }

  return {
    marketplace: {
      salesCount: closedTx.length,
      totalFcfa: totalSales,
      avgPricePerKg,
      pigPriceIndexDeltaPct: null,
      salesByCategory: [...categoryMap.entries()].map(([label, v]) => ({
        label,
        count: v.count,
        amount: v.amount
      })),
      topSales,
      unsoldListingsCount: unsoldListings.length,
      unsoldEstimatedValue: unsoldValue,
      pendingEscrowCount: pendingEscrowAgg._count._all,
      pendingEscrowAmount: Number(pendingEscrowAgg._sum.blockedAmount ?? 0),
      pendingDeliveryCount
    },
    recommendations: recommendations.slice(0, 5),
    objectives: objectives.slice(0, 3),
    bankScoring: {
      riskLevel: riskLevelLabel(score.global),
      risqueSanitaire: score.breakdown.herdHealth.score,
      risqueFinancier: score.breakdown.financialHealth.score,
      risqueOperationnel: Math.round(
        (score.breakdown.productivity.score +
          score.breakdown.dataRegularity.score) /
          2
      ),
      avgMonthlyRevenue: Math.round(rev / monthsInPeriod),
      herdGrowthPct: headDelta
    },
    cheptelCategories: {
      total: totalHead,
      breedingFemales: countCat(AnimalProductionCategory.breeding_female),
      piglets: countCat(AnimalProductionCategory.starter),
      fattening: countCat(AnimalProductionCategory.fattening),
      breedingMales: countCat(AnimalProductionCategory.breeding_male),
      headcountDeltaPct: headDelta
    },
    gestationExtended: {
      activeGestations: Number(
        (sections.gestation as { activeBreeders?: number })?.activeBreeders ?? 0
      ),
      expectedFarrowingsThisMonth: upcomingFarrow.length,
      avgLitterSize: null,
      upcomingFarrowings: upcomingFarrow.map((a) => ({
        label: a.tagCode ?? a.publicId ?? "Truie",
        date: a.expectedFarrowingAt!.toISOString()
      }))
    },
    feedExtended: {
      stockDaysRemaining: minDays != null && minDays < 900 ? minDays : null,
      stockAlertLevel,
      costPerKgProduced,
      fcr: null,
      adg: null
    }
  };
}
