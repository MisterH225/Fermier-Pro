import { Injectable } from "@nestjs/common";
import {
  FarmDiseaseCaseStatus,
  FarmHealthRecordKind,
  LivestockExitKind
} from "@prisma/client";
import { buildFeedStockStatsForFarm } from "../feed-stock/feed-stock-stats.helper";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { PrismaService } from "../prisma/prisma.service";
import type { AiModuleKey } from "./ai.types";

@Injectable()
export class AiDataAggregatorService {
  constructor(private readonly prisma: PrismaService) {}

  async hasSufficientData(farmId: string, module: AiModuleKey): Promise<boolean> {
    switch (module) {
      case "finance": {
        const [exp, rev] = await Promise.all([
          this.prisma.farmExpense.count({ where: { farmId } }),
          this.prisma.farmRevenue.count({ where: { farmId } })
        ]);
        return exp + rev > 0;
      }
      case "cheptel": {
        const [animals, batches] = await Promise.all([
          this.prisma.animal.count({ where: { farmId, status: "active" } }),
          this.prisma.livestockBatch.aggregate({
            where: { farmId, status: "active" },
            _sum: { headcount: true }
          })
        ]);
        return animals > 0 || (batches._sum.headcount ?? 0) > 0;
      }
      case "sante": {
        const records = await this.prisma.farmHealthRecord.count({
          where: { farmId }
        });
        const animals = await this.prisma.animal.count({
          where: { farmId, status: "active" }
        });
        return records > 0 || animals > 0;
      }
      case "sante_diseases": {
        const active = await this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            disease: { caseStatus: FarmDiseaseCaseStatus.active }
          }
        });
        return active > 0;
      }
      case "stock": {
        const types = await this.prisma.feedType.count({ where: { farmId } });
        return types > 0;
      }
      case "gestation": {
        const gestating = await this.prisma.animal.count({
          where: {
            farmId,
            status: "active",
            expectedFarrowingAt: { not: null }
          }
        });
        const females = await this.prisma.animal.count({
          where: { farmId, status: "active", sex: "female" }
        });
        return gestating > 0 || females > 0;
      }
      case "global_dashboard": {
        const farm = await this.prisma.farm.findUnique({
          where: { id: farmId },
          select: { id: true }
        });
        if (!farm) {
          return false;
        }
        const checks = await Promise.all([
          this.hasSufficientData(farmId, "finance"),
          this.hasSufficientData(farmId, "cheptel"),
          this.hasSufficientData(farmId, "sante"),
          this.hasSufficientData(farmId, "stock")
        ]);
        return checks.some(Boolean);
      }
      default:
        return false;
    }
  }

  async aggregate(farmId: string, module: AiModuleKey): Promise<unknown> {
    switch (module) {
      case "finance":
        return this.aggregateFinance(farmId);
      case "cheptel":
        return this.aggregateCheptel(farmId);
      case "sante":
        return this.aggregateSante(farmId);
      case "sante_diseases":
        return this.aggregateSanteDiseases(farmId);
      case "stock":
        return this.aggregateStock(farmId);
      case "gestation":
        return this.aggregateGestation(farmId);
      case "global_dashboard":
        return this.aggregateDashboard(farmId);
      default:
        return {};
    }
  }

  private async aggregateFinance(farmId: string) {
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const threeMonthsAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)
    );

    const [settings, monthExp, monthRev, expenses, revenues, budget] =
      await Promise.all([
        this.prisma.farmFinanceSettings.findUnique({ where: { farmId } }),
        this.prisma.farmExpense.aggregate({
          where: {
            farmId,
            occurredAt: { gte: monthStart }
          },
          _sum: { amount: true }
        }),
        this.prisma.farmRevenue.aggregate({
          where: {
            farmId,
            occurredAt: { gte: monthStart }
          },
          _sum: { amount: true }
        }),
        this.prisma.farmExpense.findMany({
          where: { farmId, occurredAt: { gte: threeMonthsAgo } },
          select: {
            amount: true,
            occurredAt: true,
            category: true,
            financeCategory: { select: { name: true } }
          }
        }),
        this.prisma.farmRevenue.findMany({
          where: { farmId, occurredAt: { gte: threeMonthsAgo } },
          select: { amount: true, occurredAt: true }
        }),
        this.prisma.farmBudget.findFirst({
          where: { farmId, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 },
          include: {
            lines: {
              include: { category: { select: { name: true } } }
            }
          }
        })
      ]);

    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      const name = e.financeCategory?.name ?? e.category ?? "Autre";
      byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount.toNumber());
    }
    const topExpenses = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, total]) => ({
        category,
        total: Math.round(total)
      }));

    const monthlyTotals: { month: string; expenses: number; revenues: number }[] =
      [];
    for (let delta = 2; delta >= 0; delta -= 1) {
      const ref = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - delta, 1)
      );
      const start = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)
      );
      const end = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1)
      );
      const label = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
      let expSum = 0;
      let revSum = 0;
      for (const e of expenses) {
        if (e.occurredAt >= start && e.occurredAt < end) {
          expSum += e.amount.toNumber();
        }
      }
      for (const r of revenues) {
        if (r.occurredAt >= start && r.occurredAt < end) {
          revSum += r.amount.toNumber();
        }
      }
      monthlyTotals.push({
        month: label,
        expenses: Math.round(expSum),
        revenues: Math.round(revSum)
      });
    }

    const te = monthExp._sum.amount?.toNumber() ?? 0;
    const tr = monthRev._sum.amount?.toNumber() ?? 0;
    let budgetPlanned = 0;
    let budgetSpent = te;
    const budgetByCategory: { category: string; planned: number; spent: number }[] =
      [];
    if (budget) {
      for (const line of budget.lines) {
        const planned = line.amountPlanned.toNumber();
        budgetPlanned += planned;
        budgetByCategory.push({
          category: line.category?.name ?? "—",
          planned: Math.round(planned),
          spent: 0
        });
      }
    }

    const marginTrend =
      monthlyTotals.length >= 2
        ? monthlyTotals[monthlyTotals.length - 1]!.revenues -
          monthlyTotals[monthlyTotals.length - 1]!.expenses -
          (monthlyTotals[0]!.revenues - monthlyTotals[0]!.expenses)
        : 0;

    const budgetExecutionPct =
      budgetPlanned > 0
        ? Math.round((budgetSpent / budgetPlanned) * 100)
        : null;

    return {
      currency: settings?.currencyCode ?? "XOF",
      last3Months: monthlyTotals,
      currentMonth: {
        expenses: Math.round(te),
        revenues: Math.round(tr),
        netMargin: Math.round(tr - te)
      },
      marginTrendDirection: marginTrend >= 0 ? "up" : "down",
      topExpenseCategories: topExpenses,
      budgetExecutionPct,
      budgetByCategory: budgetByCategory.slice(0, 8),
      balancePositiveMonths: monthlyTotals.filter(
        (m) => m.revenues > m.expenses
      ).length
    };
  }

  private async aggregateCheptel(farmId: string) {
    const [animals, batches, pens, gmqSettings] = await Promise.all([
      this.prisma.animal.findMany({
        where: { farmId, status: "active" },
        select: { id: true, sex: true, status: true }
      }),
      this.prisma.livestockBatch.findMany({
        where: { farmId, status: "active" },
        select: { headcount: true, categoryKey: true }
      }),
      this.prisma.pen.findMany({
        where: { barn: { farmId } },
        select: {
          id: true,
          name: true,
          capacity: true,
          placements: {
            where: { endedAt: null },
            select: {
              animalId: true,
              batch: { select: { headcount: true } }
            }
          }
        }
      }),
      this.prisma.farmGmqSettings.findMany({ where: { farmId } })
    ]);

    const categoryHeadcount: Record<string, number> = {};
    for (const b of batches) {
      const k = b.categoryKey ?? "other";
      categoryHeadcount[k] = (categoryHeadcount[k] ?? 0) + b.headcount;
    }
    categoryHeadcount.active_animals = animals.length;

    const penRows = pens.map((pen) => {
      let occ = 0;
      for (const pl of pen.placements) {
        if (pl.animalId) {
          occ += 1;
        } else if (pl.batch?.headcount) {
          occ += pl.batch.headcount;
        }
      }
      const cap = pen.capacity ?? 0;
      const rate = cap > 0 ? Math.round((occ / cap) * 100) : null;
      return {
        name: pen.name,
        occupancy: occ,
        capacity: cap,
        occupancyPct: rate,
        status:
          cap > 0 && occ >= cap
            ? "overcrowded"
            : cap > 0 && occ / cap < 0.4
              ? "underused"
              : "ok"
      };
    });

    const placedIds = new Set(
      pens.flatMap((p) =>
        p.placements.map((pl) => pl.animalId).filter((id): id is string => !!id)
      )
    );
    const unassigned = animals.filter((a) => !placedIds.has(a.id)).length;

    const targetGmq =
      gmqSettings.find((s) => s.categoryKey === "finishing")?.targetGmqGPerDay ??
      null;

    const recentWeights = await this.prisma.animalWeight.count({
      where: {
        animal: { farmId, status: "active" },
        measuredAt: {
          gte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
        }
      }
    });

    return {
      headcountByCategory: categoryHeadcount,
      totalActiveAnimals: animals.length,
      totalBatchHeadcount: batches.reduce((s, b) => s + b.headcount, 0),
      pens: penRows.slice(0, 12),
      overcrowdedPens: penRows.filter((p) => p.status === "overcrowded").length,
      underusedPens: penRows.filter((p) => p.status === "underused").length,
      unassignedAnimals: unassigned,
      targetGmqGPerDay: targetGmq?.toNumber() ?? null,
      weighingsLast3Weeks: recentWeights,
      avgOccupancyPct:
        penRows.length > 0
          ? Math.round(
              penRows.reduce((s, p) => s + (p.occupancyPct ?? 0), 0) /
                penRows.length
            )
          : null
    };
  }

  private async aggregateSante(farmId: string) {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      activeDiseases,
      vaccinesDue,
      vaccinesOverdue,
      lastVet,
      mortalAgg,
      activeHead,
      treatments
    ] = await Promise.all([
      this.prisma.farmHealthRecord.count({
        where: {
          farmId,
          kind: FarmHealthRecordKind.disease,
          disease: { caseStatus: FarmDiseaseCaseStatus.active }
        }
      }),
      this.prisma.healthVaccinationDetail.count({
        where: {
          healthRecord: { farmId },
          nextReminderAt: { gte: now, lte: in7 }
        }
      }),
      this.prisma.healthVaccinationDetail.count({
        where: {
          healthRecord: { farmId },
          nextReminderAt: { lt: now }
        }
      }),
      this.prisma.farmHealthRecord.findFirst({
        where: { farmId, kind: FarmHealthRecordKind.vet_visit },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true }
      }),
      this.prisma.livestockExit.aggregate({
        where: {
          farmId,
          kind: LivestockExitKind.mortality,
          occurredAt: { gte: since30 }
        },
        _sum: { headcountAffected: true }
      }),
      this.prisma.animal.count({ where: { farmId, status: "active" } }),
      this.prisma.farmHealthRecord.count({
        where: {
          farmId,
          kind: FarmHealthRecordKind.treatment,
          occurredAt: { gte: since30 }
        }
      })
    ]);

    const dead = mortalAgg._sum.headcountAffected ?? 0;
    const mortalityPct =
      activeHead + dead > 0
        ? Math.round((dead / (activeHead + dead)) * 1000) / 10
        : 0;

    const daysSinceVet = lastVet
      ? Math.floor(
          (now.getTime() - lastVet.occurredAt.getTime()) / (24 * 60 * 60 * 1000)
        )
      : null;

    return {
      activeDiseaseCases: activeDiseases,
      vaccinesDueNext7Days: vaccinesDue,
      vaccinesOverdue: vaccinesOverdue,
      treatmentsLast30Days: treatments,
      mortalityRate30dPct: mortalityPct,
      daysSinceLastVetVisit: daysSinceVet
    };
  }

  private async aggregateSanteDiseases(farmId: string) {
    const now = new Date();
    const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [activeRows, history90, resolved30, activeHead, sickHead, overdueVac, pens] =
      await Promise.all([
        this.prisma.farmHealthRecord.findMany({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            disease: { caseStatus: FarmDiseaseCaseStatus.active }
          },
          include: {
            disease: {
              select: {
                diagnosis: true,
                severity: true,
                durationEstimate: true,
                inIsolation: true,
                treatmentOngoing: true,
                symptoms: true
              }
            }
          },
          orderBy: { occurredAt: "desc" },
          take: 15
        }),
        this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            occurredAt: { gte: since90 }
          }
        }),
        this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            disease: {
              caseStatus: FarmDiseaseCaseStatus.recovered,
              resolvedAt: { gte: since30 }
            }
          }
        }),
        this.prisma.animal.count({
          where: { farmId, status: "active" }
        }),
        this.prisma.animal.count({
          where: { farmId, status: "active", healthStatus: "sick" }
        }),
        this.prisma.healthVaccinationDetail.count({
          where: {
            healthRecord: { farmId },
            nextReminderAt: { lt: now }
          }
        }),
        this.prisma.pen.count({ where: { barn: { farmId } } })
      ]);

    const activeCases = activeRows.map((r) => {
      const tags = (r.disease?.symptoms as { tags?: string[] } | null)?.tags ?? [];
      return {
        entityId: r.entityId,
        entityType: r.entityType,
        diagnosis: r.disease?.diagnosis ?? tags[0] ?? "Autre",
        severity: r.disease?.severity ?? null,
        durationEstimate: r.disease?.durationEstimate ?? null,
        inIsolation: r.disease?.inIsolation ?? false,
        treatmentOngoing: r.disease?.treatmentOngoing ?? false,
        symptoms: tags,
        declaredAt: r.occurredAt.toISOString()
      };
    });

    const diseaseRatePct =
      activeHead > 0
        ? Math.round((activeRows.length / activeHead) * 1000) / 10
        : 0;

    return {
      activeCases,
      activeCaseCount: activeRows.length,
      diseaseRatePct,
      sickAnimals: sickHead,
      activeHeadcount: activeHead,
      historyCases90d: history90,
      resolvedLast30d: resolved30,
      vaccinesOverdue: overdueVac,
      penCount: pens
    };
  }

  private async aggregateStock(farmId: string) {
    const settings = await this.prisma.farmAlertSettings.findUnique({
      where: { farmId }
    });
    const stats = await buildFeedStockStatsForFarm(this.prisma, farmId, {
      criticalDays: settings?.stockCriticalDays ?? 7,
      warningDays: settings?.stockWarningDays ?? 15
    });

    return {
      feedTypes: stats.map((s) => ({
        name: s.name,
        stockKg: Math.round(Number(s.currentStockKg)),
        daysRemaining: s.daysRemaining,
        dailyConsumptionKg: s.avgDailyConsumptionKg
          ? Math.round(Number(s.avgDailyConsumptionKg))
          : null,
        status: s.status,
        estimatedDepletionDate: s.estimatedDepletionDate
      })),
      criticalCount: stats.filter((s) => s.status === "critical").length,
      warningCount: stats.filter((s) => s.status === "warning").length
    };
  }

  private async aggregateGestation(farmId: string) {
    const now = new Date();
    const gestating = await this.prisma.animal.findMany({
      where: {
        farmId,
        status: "active",
        expectedFarrowingAt: { not: null }
      },
      select: {
        id: true,
        expectedFarrowingAt: true,
        sex: true
      },
      orderBy: { expectedFarrowingAt: "asc" },
      take: 20
    });

    const females = await this.prisma.animal.count({
      where: { farmId, status: "active", sex: "female" }
    });
    const males = await this.prisma.animal.count({
      where: { farmId, status: "active", sex: "male" }
    });

    const items = gestating.map((a) => {
      const due = a.expectedFarrowingAt!;
      const days = Math.max(
        0,
        Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );
      return { daysUntilFarrowing: days, urgent: days <= 7 };
    });

    return {
      gestatingCount: gestating.length,
      imminentFarrowings: items.filter((i) => i.urgent).length,
      gestationSchedule: items.slice(0, 8),
      availableFemales: females,
      availableMales: males
    };
  }

  private async aggregateDashboard(farmId: string) {
    const [finance, cheptel, sante, stock, gestation] = await Promise.all([
      this.aggregateFinance(farmId).catch(() => null),
      this.aggregateCheptel(farmId).catch(() => null),
      this.aggregateSante(farmId).catch(() => null),
      this.aggregateStock(farmId).catch(() => null),
      this.aggregateGestation(farmId).catch(() => null)
    ]);
    return { finance, cheptel, sante, stock, gestation };
  }
}
