import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmDiseaseCaseStatus,
  FarmHealthRecordKind,
  FeedMovementKind,
  FinanceCategoryType,
  LivestockExitKind,
  Prisma,
  ReportPeriodType
} from "@prisma/client";
import { createHash } from "crypto";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { buildFeedStockStatsForFarm } from "../feed-stock/feed-stock-stats.helper";
import { FinanceService } from "../finance/finance.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import { previousPeriod, resolveReportPeriod } from "./reports-period.util";
import { computeFarmScore } from "./reports-score.util";
import { ReportsPdfService } from "./reports-pdf.service";

export type ReportAnchorDto = {
  year: number;
  month?: number;
  quarter?: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly finance: FinanceService,
    private readonly smartAlerts: SmartAlertsService,
    private readonly pdf: ReportsPdfService
  ) {}

  private async requireFarmRead(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
  }

  async preview(
    user: User,
    farmId: string,
    periodType: ReportPeriodType,
    anchor: ReportAnchorDto
  ) {
    await this.requireFarmRead(user, farmId);
    const { start, end } = resolveReportPeriod(periodType, anchor);
    const snap = await this.buildDataSnapshot(user, farmId, periodType, start, end);
    const score = this.scoreFromSnapshot(snap);
    return {
      farmId,
      periodType,
      period: { start: start.toISOString(), end: end.toISOString() },
      score,
      sections: snap
    };
  }

  async currentScore(user: User, farmId: string, anchor: ReportAnchorDto) {
    const p = await this.preview(user, farmId, "monthly", {
      year: anchor.year,
      month: anchor.month ?? new Date().getUTCMonth() + 1
    });
    return {
      farmId,
      scoreGlobal: p.score.global,
      scoreBreakdown: p.score.breakdown,
      band: p.score.band
    };
  }

  async listReports(user: User, farmId: string) {
    await this.requireFarmRead(user, farmId);
    return this.prisma.farmReport.findMany({
      where: { farmId },
      orderBy: { generatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        generatedAt: true,
        scoreGlobal: true,
        contentHash: true
      }
    });
  }

  async getReport(user: User, reportId: string) {
    const row = await this.prisma.farmReport.findUnique({
      where: { id: reportId }
    });
    if (!row) {
      throw new NotFoundException("Rapport introuvable");
    }
    await this.requireFarmRead(user, row.farmId);
    return row;
  }

  async generateReport(
    user: User,
    farmId: string,
    periodType: ReportPeriodType,
    anchor: ReportAnchorDto
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeRead,
      FARM_SCOPE.livestockRead
    ]);
    const { start, end } = resolveReportPeriod(periodType, anchor);
    const sections = await this.buildDataSnapshot(user, farmId, periodType, start, end);
    const score = this.scoreFromSnapshot(sections);
    const snapshot = {
      farmId,
      periodType,
      period: { start: start.toISOString(), end: end.toISOString() },
      score,
      sections
    };
    const json = JSON.stringify(snapshot);
    const contentHash = createHash("sha256").update(json).digest("hex");
    const row = await this.prisma.farmReport.create({
      data: {
        farmId,
        periodType,
        periodStart: start,
        periodEnd: end,
        scoreGlobal: score.global,
        scoreBreakdown: score.breakdown as unknown as Prisma.InputJsonValue,
        dataSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        contentHash,
        createdByUserId: user.id
      }
    });
    return { id: row.id, scoreGlobal: row.scoreGlobal, contentHash };
  }

  async buildReportPdf(
    user: User,
    reportId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.getReport(user, reportId);
    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: row.farmId },
      include: { owner: { select: { fullName: true, firstName: true, lastName: true } } }
    });
    const buffer = await this.pdf.renderFarmReportPdf({
      farmName: farm.name,
      ownerName:
        farm.owner.fullName?.trim() ||
        [farm.owner.firstName, farm.owner.lastName].filter(Boolean).join(" ") ||
        "Producteur",
      address: farm.address,
      report: row
    });
    const safeFarm = farm.name
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48);
    const p0 = row.periodStart.toISOString().slice(0, 10);
    const p1 = row.periodEnd.toISOString().slice(0, 10);
    const filename = `Rapport_${safeFarm || "Ferme"}_${p0}_${p1}.pdf`;
    return { buffer, filename };
  }

  private scoreFromSnapshot(sections: {
    finance: {
      current?: { totals: { revenues: string; expenses: string } };
      currentMeta: {
        entryCount: number;
        healthRecords: number;
        feedMovements: number;
      };
    };
    health: { mortalityRate: number; vaccineOverdueCount: number };
    gestation: { farrowingsCount: number };
    meta: { farmAgeMonths: number; monthsWithFinance: number };
  }) {
    const fin = sections.finance;
    const rev = Number(fin.current?.totals.revenues ?? 0);
    const exp = Number(fin.current?.totals.expenses ?? 0);
    const marginRatio = rev > 0 ? (rev - exp) / rev : 0;

    const entryDensity =
      fin.currentMeta.entryCount +
      fin.currentMeta.healthRecords +
      fin.currentMeta.feedMovements;

    const herd = sections.health;
    const mort = Number(herd.mortalityRate ?? 0);
    const vaccOd = herd.vaccineOverdueCount ?? 0;

    const gest = sections.gestation;
    const farm = sections.meta.farmAgeMonths;
    const monthsFin = sections.meta.monthsWithFinance;

    return computeFarmScore({
      entryDensity,
      marginRatio,
      mortalityRate: mort,
      vaccineOverdueCount: vaccOd,
      farrowingsCount: gest.farrowingsCount,
      farmAgeMonths: farm,
      monthsWithFinanceData: monthsFin
    });
  }

  async buildDataSnapshot(
    user: User,
    farmId: string,
    periodType: ReportPeriodType,
    start: Date,
    end: Date
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const prev = previousPeriod(periodType, start, end);

    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId }
    });
    const farmAgeMonths = Math.max(
      1,
      Math.floor(
        (Date.now() - farm.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
      )
    );

    const financeCurrent = await this.finance.financeReportRange(
      user,
      farmId,
      start,
      end
    );
    const financePrev = await this.finance.financeReportRange(
      user,
      farmId,
      prev.start,
      prev.end
    );

    const curRev = Number(financeCurrent.totals.revenues);
    const curExp = Number(financeCurrent.totals.expenses);
    const prevRev = Number(financePrev.totals.revenues);
    const prevExp = Number(financePrev.totals.expenses);
    const deltaRevPct =
      prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 100) : null;
    const deltaExpPct =
      prevExp > 0 ? Math.round(((curExp - prevExp) / prevExp) * 100) : null;

    const monthlyTrend = await this.financeMonthlyTrend(farmId, start, end);

    const topExp = [...financeCurrent.byCategory]
      .map((r) => ({
        label: r.label,
        expenses: Number(r.expenses)
      }))
      .sort((a, b) => b.expenses - a.expenses)
      .slice(0, 3);
    const topRev = [...financeCurrent.byCategory]
      .map((r) => ({
        label: r.label,
        revenues: Number(r.revenues)
      }))
      .sort((a, b) => b.revenues - a.revenues)
      .slice(0, 3);

    const [expCount, revCount, healthCount, feedMovCount] = await Promise.all([
      this.prisma.farmExpense.count({
        where: { farmId, occurredAt: { gte: start, lt: end } }
      }),
      this.prisma.farmRevenue.count({
        where: { farmId, occurredAt: { gte: start, lt: end } }
      }),
      this.prisma.farmHealthRecord.count({
        where: { farmId, occurredAt: { gte: start, lt: end } }
      }),
      this.prisma.feedStockMovement.count({
        where: { farmId, occurredAt: { gte: start, lt: end } }
      })
    ]);

    const monthsWithFinance = await this.prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT m)::bigint AS c
      FROM (
        SELECT date_trunc('month', "occurredAt") AS m
        FROM "FarmExpense"
        WHERE "farmId" = ${farmId}
        UNION
        SELECT date_trunc('month', "occurredAt")
        FROM "FarmRevenue"
        WHERE "farmId" = ${farmId}
      ) t
    `;
    const mwf = Number(monthsWithFinance[0]?.c ?? 0n);

    const activeHead = await this.prisma.animal.count({
      where: { farmId, status: "active" }
    });
    const births = await this.prisma.animal.count({
      where: {
        farmId,
        birthDate: { gte: start, lt: end }
      }
    });
    const exits = await this.prisma.livestockExit.findMany({
      where: {
        farmId,
        occurredAt: { gte: start, lt: end }
      },
      select: { kind: true, headcountAffected: true }
    });
    let sales = 0;
    let deaths = 0;
    let reforms = 0;
    for (const e of exits) {
      const n = e.headcountAffected ?? 1;
      if (e.kind === LivestockExitKind.sale) sales += n;
      if (e.kind === LivestockExitKind.mortality) deaths += n;
      if (e.kind === LivestockExitKind.slaughter) reforms += n;
    }

    const headcountStartEstimate = Math.max(
      0,
      activeHead - births + sales + deaths + reforms
    );

    const batchesActive = await this.prisma.livestockBatch.count({
      where: { farmId, status: "active" }
    });
    const batchesClosed = await this.prisma.livestockBatch.count({
      where: { farmId, status: { not: "active" } }
    });

    const diseaseCases = await this.prisma.farmHealthRecord.count({
      where: {
        farmId,
        kind: FarmHealthRecordKind.disease,
        occurredAt: { gte: start, lt: end }
      }
    });
    const vaccinesDone = await this.prisma.farmHealthRecord.count({
      where: {
        farmId,
        kind: FarmHealthRecordKind.vaccination,
        occurredAt: { gte: start, lt: end }
      }
    });
    const vetVisits = await this.prisma.farmHealthRecord.count({
      where: {
        farmId,
        kind: FarmHealthRecordKind.vet_visit,
        occurredAt: { gte: start, lt: end }
      }
    });
    const now = new Date();
    const overdueVac = await this.prisma.healthVaccinationDetail.count({
      where: {
        healthRecord: { farmId },
        nextReminderAt: { lt: now }
      }
    });
    const since = start;
    const mortalAgg = await this.prisma.livestockExit.aggregate({
      where: {
        farmId,
        kind: LivestockExitKind.mortality,
        occurredAt: { gte: since, lt: end }
      },
      _sum: { headcountAffected: true }
    });
    const dead = mortalAgg._sum.headcountAffected ?? 0;
    const mortalityRate =
      activeHead + dead > 0 ? dead / Math.max(1, activeHead + dead) : 0;

    const healthSpend = await this.prisma.farmExpense.aggregate({
      where: {
        farmId,
        occurredAt: { gte: start, lt: end },
        OR: [
          {
            financeCategory: {
              farmId,
              type: FinanceCategoryType.expense,
              key: "health"
            }
          },
          { category: { contains: "sant", mode: "insensitive" } }
        ]
      },
      _sum: { amount: true }
    });

    const feedChecks = await this.prisma.feedStockMovement.count({
      where: {
        farmId,
        kind: FeedMovementKind.stock_check,
        occurredAt: { gte: start, lt: end }
      }
    });
    const feedInKg = await this.prisma.feedStockMovement.aggregate({
      where: {
        farmId,
        kind: FeedMovementKind.in,
        occurredAt: { gte: start, lt: end }
      },
      _sum: { quantityKg: true }
    });
    const feedCost = await this.prisma.farmExpense.aggregate({
      where: {
        farmId,
        occurredAt: { gte: start, lt: end },
        financeCategory: {
          farmId,
          type: FinanceCategoryType.expense,
          key: "feed"
        }
      },
      _sum: { amount: true }
    });
    const feedCostNum = Number(feedCost._sum.amount ?? 0);
    const headDays = Math.max(1, activeHead * ((end.getTime() - start.getTime()) / 86400000));
    const costPerHeadDay = headDays > 0 ? feedCostNum / headDays : 0;
    const ratioFeedRev = curRev > 0 ? (feedCostNum / curRev) * 100 : null;

    const farrowings = await this.prisma.animal.count({
      where: {
        farmId,
        birthDate: { gte: start, lt: end }
      }
    });
    const activeSows = await this.prisma.animal.count({
      where: {
        farmId,
        status: "active",
        expectedFarrowingAt: { not: null }
      }
    });

    const [diseaseActive, diseaseResolved, vaccinesPlanned, diseaseRows] =
      await Promise.all([
        this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            occurredAt: { gte: start, lt: end },
            disease: { caseStatus: FarmDiseaseCaseStatus.active }
          }
        }),
        this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            occurredAt: { gte: start, lt: end },
            disease: {
              caseStatus: {
                in: [
                  FarmDiseaseCaseStatus.recovered,
                  FarmDiseaseCaseStatus.dead,
                  FarmDiseaseCaseStatus.slaughtered
                ]
              }
            }
          }
        }),
        this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.vaccination,
            occurredAt: { gte: start, lt: end },
            vaccination: { reminderDays: { not: null } }
          }
        }),
        this.prisma.healthDiseaseDetail.findMany({
          where: {
            healthRecord: {
              farmId,
              kind: FarmHealthRecordKind.disease,
              occurredAt: { gte: start, lt: end }
            },
            diagnosis: { not: null }
          },
          select: { diagnosis: true }
        })
      ]);

    const diseaseLabelCounts = new Map<string, number>();
    for (const r of diseaseRows) {
      const lab = (r.diagnosis ?? "").trim() || "Autre";
      diseaseLabelCounts.set(lab, (diseaseLabelCounts.get(lab) ?? 0) + 1);
    }
    const topDiseases = [...diseaseLabelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));

    const vaccineCompletionPct =
      vaccinesDone + overdueVac > 0
        ? Math.round((100 * vaccinesDone) / (vaccinesDone + overdueVac))
        : vaccinesDone > 0
          ? 100
          : null;

    const speciesGroups = await this.prisma.animal.groupBy({
      by: ["speciesId"],
      where: { farmId, status: "active" },
      _count: { _all: true }
    });
    const speciesIds = speciesGroups.map((g) => g.speciesId);
    const speciesRows =
      speciesIds.length === 0
        ? []
        : await this.prisma.species.findMany({
            where: { id: { in: speciesIds } },
            select: { id: true, name: true }
          });
    const speciesNameById = new Map(speciesRows.map((s) => [s.id, s.name]));
    const animalsBySpecies = speciesGroups.map((g) => ({
      name: speciesNameById.get(g.speciesId) ?? "—",
      count: g._count._all
    }));

    const feedCheckRows = await this.prisma.feedStockMovement.findMany({
      where: {
        farmId,
        kind: FeedMovementKind.stock_check,
        occurredAt: { gte: start, lt: end }
      },
      include: {
        feedType: { select: { id: true, name: true, weightPerBagKg: true } }
      }
    });
    const consumptionByTypeMap = new Map<string, { name: string; kg: number }>();
    for (const m of feedCheckRows) {
      const wp = Number(m.feedType.weightPerBagKg ?? 0);
      const bags = Number(m.bagsConsumed ?? 0);
      const kg = bags > 0 && wp > 0 ? bags * wp : 0;
      const cur = consumptionByTypeMap.get(m.feedTypeId) ?? {
        name: m.feedType.name,
        kg: 0
      };
      cur.kg += kg;
      consumptionByTypeMap.set(m.feedTypeId, cur);
    }
    const consumptionByType = [...consumptionByTypeMap.values()].map((v) => ({
      name: v.name,
      consumedKg: v.kg.toFixed(1)
    }));

    const feedStats = await buildFeedStockStatsForFarm(this.prisma, farmId, {
      criticalDays: 7,
      warningDays: 15
    });
    const stockBreakTypes = feedStats.filter((s) => s.status === "critical").length;

    const prevMargin = prevRev - prevExp;
    const curMargin = curRev - curExp;
    let marginTrend: "hausse" | "baisse" | "stable" = "stable";
    if (Number.isFinite(prevMargin) && Math.abs(prevMargin) > 1) {
      const rel = (curMargin - prevMargin) / Math.abs(prevMargin);
      if (rel > 0.05) marginTrend = "hausse";
      else if (rel < -0.05) marginTrend = "baisse";
    }

    const gestationSuccessPct =
      activeSows + farrowings > 0
        ? Math.min(
            100,
            Math.round((100 * farrowings) / Math.max(1, activeSows + farrowings))
          )
        : null;

    const projection = await this.finance.financeProjection(user, farmId);
    const alerts = await this.smartAlerts.evaluateDrafts(farmId);
    const topAlerts = alerts
      .sort(
        (a, b) =>
          (a.priority === "critical" ? 0 : a.priority === "warning" ? 1 : 2) -
          (b.priority === "critical" ? 0 : b.priority === "warning" ? 1 : 2)
      )
      .slice(0, 3)
      .map((a) => ({
        title: a.title,
        message: a.message,
        priority: a.priority
      }));

    const healthStatus =
      mortalityRate > 0.06 || overdueVac > 2
        ? "critique"
        : mortalityRate > 0.03 || overdueVac > 0
          ? "attention"
          : "bon";

    return {
      meta: {
        farmAgeMonths,
        monthsWithFinance: mwf
      },
      finance: {
        current: financeCurrent,
        previous: financePrev,
        deltaRevenuesPct: deltaRevPct,
        deltaExpensesPct: deltaExpPct,
        marginPct: curRev > 0 ? ((curRev - curExp) / curRev) * 100 : null,
        monthlyTrend,
        topExpenses: topExp,
        topRevenues: topRev,
        budgetExecutionPct: null,
        currentMeta: {
          entryCount: expCount + revCount,
          healthRecords: healthCount,
          feedMovements: feedMovCount
        }
      },
      cheptel: {
        headcountStartEstimate,
        headcountEnd: activeHead,
        births,
        salesExits: sales,
        deaths,
        reformsExits: reforms,
        batchesActive,
        batchesClosed,
        animalsBySpecies
      },
      health: {
        mortalityRate,
        diseaseCases,
        diseaseActive,
        diseaseResolved,
        vaccinesDone,
        vaccinesPlanned,
        vaccineCompletionPct,
        vetVisits,
        healthSpend: (healthSpend._sum.amount ?? new Prisma.Decimal(0)).toString(),
        vaccineOverdueCount: overdueVac,
        healthStatus,
        topDiseases
      },
      feed: {
        feedInKg: (feedInKg._sum.quantityKg ?? new Prisma.Decimal(0)).toString(),
        feedCost: String(feedCostNum),
        stockChecks: feedChecks,
        costPerHeadDay,
        ratioFeedRevenuesPct: ratioFeedRev,
        consumptionByType,
        stockBreakTypes
      },
      gestation: {
        farrowingsCount: farrowings,
        activeBreeders: activeSows,
        gestationSuccessPct,
        avgPigletsPerFarrowing: null,
        neonatalMortalityPct: null,
        avgDaysBetweenFarrowing: null
      },
      projection: {
        nextMonths: projection.nextMonths,
        deficitAlert: projection.deficitAlert,
        marginTrend
      },
      smartAlertsTop: topAlerts
    };
  }

  private async financeMonthlyTrend(farmId: string, start: Date, end: Date) {
    const out: { month: string; revenues: string; expenses: string }[] = [];
    let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const endCap = new Date(end);
    while (d < endCap) {
      const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const [e, r] = await Promise.all([
        this.prisma.farmExpense.aggregate({
          where: { farmId, occurredAt: { gte: d, lt: n } },
          _sum: { amount: true }
        }),
        this.prisma.farmRevenue.aggregate({
          where: { farmId, occurredAt: { gte: d, lt: n } },
          _sum: { amount: true }
        })
      ]);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      out.push({
        month: key,
        expenses: (e._sum.amount ?? new Prisma.Decimal(0)).toString(),
        revenues: (r._sum.amount ?? new Prisma.Decimal(0)).toString()
      });
      d = n;
    }
    return out;
  }
}
