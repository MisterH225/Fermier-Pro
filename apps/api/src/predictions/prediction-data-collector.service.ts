import { Injectable } from "@nestjs/common";
import {
  GestationStatus,
  LivestockExitKind,
  PigPriceIndexCategory
} from "@prisma/client";
import { computeFeedStockMetrics } from "../feed-stock/feed-stock-calculation.helper";
import { decimalToNum, gmqBetween } from "../cheptel/cheptel-gmq.util";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { PrismaService } from "../prisma/prisma.service";
import {
  PREDICTION_MIN_DAYS,
  type CollectedPredictionData
} from "./prediction.types";

const MS_DAY = 86_400_000;

@Injectable()
export class PredictionDataCollectorService {
  constructor(private readonly prisma: PrismaService) {}

  async collect(farmId: string): Promise<CollectedPredictionData> {
    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: { createdAt: true }
    });

    const [
      cheptel,
      gmq,
      gestation,
      mortality,
      prices,
      feed,
      finance,
      settings,
      earliestDates
    ] = await Promise.all([
      this.collectCheptel(farmId),
      this.collectGmq(farmId),
      this.collectGestation(farmId),
      this.collectMortality(farmId),
      this.collectPrices(),
      this.collectFeed(farmId),
      this.collectFinance(farmId),
      this.collectSettings(farmId),
      this.earliestDataDates(farmId)
    ]);

    const earliest = earliestDates.length
      ? new Date(Math.min(...earliestDates.map((d) => d.getTime())))
      : farm.createdAt;
    const daysOfData = Math.max(
      0,
      Math.floor((Date.now() - earliest.getTime()) / MS_DAY)
    );

    const missing = {
      gmq: !gmq.has_data,
      price: !prices.has_data,
      feed: !feed.has_data
    };

    const qualityParts = [
      daysOfData >= PREDICTION_MIN_DAYS ? 0.3 : daysOfData / PREDICTION_MIN_DAYS / 3,
      gmq.has_data ? 0.25 : 0,
      prices.has_data ? 0.2 : 0,
      feed.has_data ? 0.15 : 0,
      finance.has_data ? 0.1 : 0
    ];
    const dataQualityScore = Math.min(
      1,
      qualityParts.reduce((s, v) => s + v, 0)
    );

    return {
      cheptel_data: cheptel,
      gmq_data: gmq,
      gestation_data: gestation,
      mortality_data: mortality,
      price_data: prices,
      feed_data: feed,
      finance_data: finance,
      settings_data: settings,
      days_of_data: daysOfData,
      data_quality_score: Math.round(dataQualityScore * 1000) / 1000,
      currency: finance.currency,
      missing
    };
  }

  private async earliestDataDates(farmId: string): Promise<Date[]> {
    const [
      weight,
      movement,
      gestation,
      expense,
      revenue,
      farm
    ] = await Promise.all([
      this.prisma.animalWeight.findFirst({
        where: { animal: { farmId } },
        orderBy: { measuredAt: "asc" },
        select: { measuredAt: true }
      }),
      this.prisma.feedStockMovement.findFirst({
        where: { farmId },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true }
      }),
      this.prisma.gestation.findFirst({
        where: { farmId },
        orderBy: { matingDate: "asc" },
        select: { matingDate: true }
      }),
      this.prisma.farmExpense.findFirst({
        where: { farmId },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true }
      }),
      this.prisma.farmRevenue.findFirst({
        where: { farmId },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true }
      }),
      this.prisma.farm.findUnique({
        where: { id: farmId },
        select: { createdAt: true }
      })
    ]);

    const dates: Date[] = [];
    if (farm) {
      dates.push(farm.createdAt);
    }
    if (weight) {
      dates.push(weight.measuredAt);
    }
    if (movement) {
      dates.push(movement.occurredAt);
    }
    if (gestation) {
      dates.push(gestation.matingDate);
    }
    if (expense) {
      dates.push(expense.occurredAt);
    }
    if (revenue) {
      dates.push(revenue.occurredAt);
    }
    return dates;
  }

  private async collectCheptel(farmId: string) {
    const [animals, batches, pens] = await Promise.all([
      this.prisma.animal.findMany({
        where: { farmId, status: "active" },
        select: {
          id: true,
          sex: true,
          entryWeightKg: true,
          productionCategory: true,
          penPlacements: {
            where: { endedAt: null },
            take: 1,
            select: { penId: true, pen: { select: { id: true, name: true } } }
          },
          weights: {
            orderBy: { measuredAt: "desc" },
            take: 1,
            select: { weightKg: true, measuredAt: true }
          }
        }
      }),
      this.prisma.livestockBatch.findMany({
        where: { farmId, status: "active" },
        select: {
          id: true,
          headcount: true,
          categoryKey: true,
          penPlacements: {
            where: { endedAt: null },
            take: 1,
            select: { penId: true, pen: { select: { id: true, name: true } } }
          },
          weights: {
            orderBy: { measuredAt: "desc" },
            take: 1,
            select: { avgWeightKg: true, measuredAt: true }
          }
        }
      }),
      this.prisma.pen.findMany({
        where: { barn: { farmId } },
        select: { id: true, name: true, capacity: true }
      })
    ]);

    const headcount =
      animals.length + batches.reduce((s, b) => s + b.headcount, 0);

    return {
      active_animals: animals.length,
      active_batches: batches.length,
      total_headcount: headcount,
      pens: pens.map((p) => ({ id: p.id, name: p.name, capacity: p.capacity })),
      animals_sample: animals.slice(0, 40).map((a) => ({
        id: a.id,
        sex: a.sex,
        category: a.productionCategory,
        pen_id: a.penPlacements[0]?.penId ?? null,
        pen_name: a.penPlacements[0]?.pen?.name ?? null,
        latest_weight_kg: a.weights[0]
          ? decimalToNum(a.weights[0].weightKg)
          : decimalToNum(a.entryWeightKg)
      })),
      batches_sample: batches.slice(0, 20).map((b) => ({
        id: b.id,
        headcount: b.headcount,
        category: b.categoryKey,
        pen_id: b.penPlacements[0]?.penId ?? null,
        pen_name: b.penPlacements[0]?.pen?.name ?? null,
        latest_avg_weight_kg: b.weights[0]
          ? decimalToNum(b.weights[0].avgWeightKg)
          : null
      }))
    };
  }

  private async collectGmq(farmId: string) {
    const since90 = new Date(Date.now() - 90 * MS_DAY);
    const weights = await this.prisma.animalWeight.findMany({
      where: {
        animal: { farmId, status: "active" },
        measuredAt: { gte: since90 }
      },
      orderBy: { measuredAt: "asc" },
      select: {
        weightKg: true,
        measuredAt: true,
        animal: {
          select: {
            id: true,
            productionCategory: true,
            penPlacements: {
              where: { endedAt: null },
              take: 1,
              select: { penId: true }
            }
          }
        }
      },
      take: 500
    });

    const byPen = new Map<
      string,
      { pen_id: string; gmq_values: number[]; weights: number[] }
    >();

    const byAnimal = new Map<string, { weights: { kg: number; at: Date }[] }>();
    for (const w of weights) {
      const aid = w.animal.id;
      if (!byAnimal.has(aid)) {
        byAnimal.set(aid, { weights: [] });
      }
      byAnimal.get(aid)!.weights.push({
        kg: decimalToNum(w.weightKg),
        at: w.measuredAt
      });
    }

    const gmqValues: number[] = [];
    for (const [, data] of byAnimal) {
      const sorted = data.weights.sort(
        (a, b) => a.at.getTime() - b.at.getTime()
      );
      for (let i = 1; i < sorted.length; i += 1) {
        const g = gmqBetween(
          sorted[i - 1].kg,
          sorted[i].kg,
          sorted[i - 1].at,
          sorted[i].at
        );
        if (g != null && Number.isFinite(g) && g > 0) {
          gmqValues.push(g);
        }
      }
    }

    for (const w of weights) {
      const penId = w.animal.penPlacements[0]?.penId ?? "unassigned";
      if (!byPen.has(penId)) {
        byPen.set(penId, { pen_id: penId, gmq_values: [], weights: [] });
      }
      byPen.get(penId)!.weights.push(decimalToNum(w.weightKg));
    }

    const penSummaries = [...byPen.entries()].map(([penId, data]) => ({
      pen_id: penId,
      avg_weight_kg:
        data.weights.length > 0
          ? data.weights.reduce((s, v) => s + v, 0) / data.weights.length
          : null,
      weighings_count: data.weights.length
    }));

    const avgGmq =
      gmqValues.length > 0
        ? gmqValues.reduce((s, v) => s + v, 0) / gmqValues.length
        : null;

    return {
      has_data: weights.length >= 2,
      weighings_count: weights.length,
      avg_gmq_g_per_day: avgGmq != null ? Math.round(avgGmq) : null,
      pen_summaries: penSummaries
    };
  }

  private async collectGestation(farmId: string) {
    const [active, settings, recentLitters] = await Promise.all([
      this.prisma.gestation.findMany({
        where: {
          farmId,
          status: GestationStatus.active
        },
        select: {
          id: true,
          matingDate: true,
          expectedBirthDate: true,
          sow: { select: { id: true, tagCode: true, publicId: true } }
        }
      }),
      this.prisma.gestationSettings.findUnique({ where: { farmId } }),
      this.prisma.litter.findMany({
        where: { gestation: { farmId } },
        orderBy: { recordedAt: "desc" },
        take: 12,
        select: {
          bornAlive: true,
          stillborn: true,
          recordedAt: true
        }
      })
    ]);

    const avgLitterSize =
      recentLitters.length > 0
        ? recentLitters.reduce(
            (s, l) => s + (l.bornAlive ?? 0),
            0
          ) / recentLitters.length
        : 11;

    return {
      gestation_duration_days: settings?.gestationDurationDays ?? 114,
      weaning_duration_days: settings?.weaningDurationDays ?? 28,
      active_gestations: active.map((g) => ({
        sow_id: g.sow.id,
        sow_number: g.sow.tagCode ?? g.sow.publicId.slice(0, 8),
        mating_date: g.matingDate.toISOString().slice(0, 10),
        expected_birth_date: g.expectedBirthDate.toISOString().slice(0, 10)
      })),
      avg_litter_size: Math.round(avgLitterSize * 10) / 10,
      recent_litters_count: recentLitters.length
    };
  }

  private async collectMortality(farmId: string) {
    const since12m = new Date(Date.now() - 365 * MS_DAY);
    const exits = await this.prisma.livestockExit.groupBy({
      by: ["kind"],
      where: {
        farmId,
        occurredAt: { gte: since12m }
      },
      _count: { id: true }
    });

    const mortalities = await this.prisma.livestockExit.count({
      where: {
        farmId,
        kind: LivestockExitKind.mortality,
        occurredAt: { gte: since12m }
      }
    });

    const activeHead = await this.prisma.animal.count({
      where: { farmId, status: "active" }
    });

    const mortalityRate =
      activeHead + mortalities > 0
        ? mortalities / (activeHead + mortalities)
        : 0;

    return {
      mortalities_12m: mortalities,
      mortality_rate_pct: Math.round(mortalityRate * 1000) / 10,
      exits_by_kind: exits.map((e) => ({
        kind: e.kind,
        count: e._count.id
      }))
    };
  }

  private async collectPrices() {
    const since12m = new Date(Date.now() - 365 * MS_DAY);
    const rows = await this.prisma.pigPriceIndexDaily.findMany({
      where: {
        date: { gte: since12m },
        category: {
          in: [
            PigPriceIndexCategory.charcutier,
            PigPriceIndexCategory.croissance,
            PigPriceIndexCategory.porcelet
          ]
        }
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        category: true,
        avgPricePerKg: true,
        transactionCount: true
      }
    });

    const byCategory = new Map<string, { date: string; price: number }[]>();
    for (const r of rows) {
      const key = r.category;
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key)!.push({
        date: r.date.toISOString().slice(0, 10),
        price: decimalToNum(r.avgPricePerKg)
      });
    }

    return {
      has_data: rows.length >= 30,
      series: Object.fromEntries(byCategory),
      latest: rows.length
        ? {
            date: rows[rows.length - 1].date.toISOString().slice(0, 10),
            charcutier:
              rows
                .filter((r) => r.category === PigPriceIndexCategory.charcutier)
                .at(-1)
                ?.avgPricePerKg != null
                ? decimalToNum(
                    rows
                      .filter(
                        (r) => r.category === PigPriceIndexCategory.charcutier
                      )
                      .at(-1)!.avgPricePerKg
                  )
                : null
          }
        : null
    };
  }

  private async collectFeed(farmId: string) {
    const settings = await this.prisma.farmAlertSettings.findUnique({
      where: { farmId }
    });
    const types = await this.prisma.feedType.findMany({
      where: { farmId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        productionPhase: true,
        currentStockKg: true
      }
    });

    const feedTypes = await Promise.all(
      types.map(async (t) => {
        const [metrics, recentChecks] = await Promise.all([
          computeFeedStockMetrics(this.prisma, farmId, t.id, {
            criticalDays: settings?.stockCriticalDays ?? 7,
            warningDays: settings?.stockWarningDays ?? 15
          }),
          this.prisma.feedStockMovement.findMany({
            where: {
              farmId,
              feedTypeId: t.id,
              kind: "stock_check",
              dailyConsumptionKg: { not: null }
            },
            orderBy: { occurredAt: "asc" },
            take: 6,
            select: { dailyConsumptionKg: true, occurredAt: true }
          })
        ]);
        const rates = recentChecks
          .map((c) => decimalToNum(c.dailyConsumptionKg))
          .filter((n) => n > 0);

        return {
          id: t.id,
          name: t.name,
          production_phase: t.productionPhase,
          current_stock_kg: decimalToNum(t.currentStockKg),
          avg_daily_consumption_kg: metrics.avgDailyConsumptionKg,
          consumption_trend_per_30d:
            rates.length >= 2
              ? (rates[rates.length - 1]! - rates[0]!) / Math.max(rates[0]!, 1)
              : 0,
          estimated_days_remaining: metrics.estimatedDaysRemaining,
          estimated_depletion_date:
            metrics.estimatedDaysRemaining != null &&
            metrics.estimatedDaysRemaining > 0
              ? new Date(
                  Date.now() + metrics.estimatedDaysRemaining * MS_DAY
                )
                  .toISOString()
                  .slice(0, 10)
              : null
        };
      })
    );

    const hasData = feedTypes.some(
      (f) => f.avg_daily_consumption_kg != null && f.avg_daily_consumption_kg > 0
    );

    return {
      has_data: hasData,
      feed_types: feedTypes
    };
  }

  private async collectFinance(farmId: string) {
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const since12m = new Date(Date.now() - 365 * MS_DAY);

    const [settings, expenses, revenues] = await Promise.all([
      this.prisma.farmFinanceSettings.findUnique({ where: { farmId } }),
      this.prisma.farmExpense.findMany({
        where: { farmId, occurredAt: { gte: since12m } },
        select: {
          amount: true,
          occurredAt: true,
          financeCategory: { select: { name: true } }
        }
      }),
      this.prisma.farmRevenue.findMany({
        where: { farmId, occurredAt: { gte: since12m } },
        select: { amount: true, occurredAt: true }
      })
    ]);

    const monthly = new Map<string, { expenses: number; revenues: number }>();
    for (const e of expenses) {
      const key = e.occurredAt.toISOString().slice(0, 7);
      if (!monthly.has(key)) {
        monthly.set(key, { expenses: 0, revenues: 0 });
      }
      monthly.get(key)!.expenses += decimalToNum(e.amount);
    }
    for (const r of revenues) {
      const key = r.occurredAt.toISOString().slice(0, 7);
      if (!monthly.has(key)) {
        monthly.set(key, { expenses: 0, revenues: 0 });
      }
      monthly.get(key)!.revenues += decimalToNum(r.amount);
    }

    return {
      has_data: expenses.length + revenues.length > 0,
      currency: settings?.currencyCode ?? "XOF",
      monthly_totals: [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({
          month,
          expenses: Math.round(v.expenses),
          revenues: Math.round(v.revenues),
          margin: Math.round(v.revenues - v.expenses)
        }))
    };
  }

  private async collectSettings(farmId: string) {
    const [profit, gmq, gestation] = await Promise.all([
      this.prisma.farmProfitabilitySettings.findUnique({ where: { farmId } }),
      this.prisma.farmGmqSettings.findMany({ where: { farmId } }),
      this.prisma.gestationSettings.findUnique({ where: { farmId } })
    ]);

    return {
      market_price_per_kg: profit?.marketPricePerKg
        ? decimalToNum(profit.marketPricePerKg)
        : null,
      ic_targets: profit
        ? {
            starter: decimalToNum(profit.icTargetStarter),
            growth: decimalToNum(profit.icTargetGrowth),
            fattening: decimalToNum(profit.icTargetFattening)
          }
        : null,
      gmq_targets: gmq.map((g) => ({
        category: g.categoryKey,
        target_gmq_g_per_day: decimalToNum(g.targetGmqGPerDay),
        target_sale_weight_kg: decimalToNum(g.targetSaleWeightKg)
      })),
      gestation_defaults: gestation
        ? {
            gestation_days: gestation.gestationDurationDays,
            weaning_days: gestation.weaningDurationDays
          }
        : null
    };
  }
}
