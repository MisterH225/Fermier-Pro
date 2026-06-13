import { Injectable } from "@nestjs/common";
import type { FeedProductionPhase } from "@prisma/client";
import { FeedMovementKind } from "@prisma/client";
import { calculateAnimalAgeWeeks } from "../cheptel/age-calculation.util";
import {
  buildGrowthStandardsFromFarm,
  resolveAutoProductionCategory,
  resolveBatchFeedPhaseFromStandards,
  resolveProductionGrowthPhase
} from "../cheptel/growth-estimation.util";
import type { ProductionGrowthPhase } from "../cheptel/growth-estimation.types";
import { DEFAULT_GROWTH_STANDARDS } from "../cheptel/growth-estimation.types";
import { decimalToNum } from "../cheptel/cheptel-gmq.util";
import { computeFeedStockMetrics } from "../feed-stock/feed-stock-calculation.helper";
import {
  effectiveFeedPhase
} from "../feed-stock/feed-production-phase.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildFeedPurchaseForecast,
  DEFAULT_IC_TARGETS,
  estimateConsumptionTrendPer30d,
  type FeedTypeForecastInput,
  type IcTargets,
  type PhaseHeadcountSeries
} from "./feed-purchase-forecast.util";
import type { FarmPredictionsPayload } from "./prediction.types";

const MS_DAY = 86_400_000;
const FORECAST_DAYS = 90;

function emptyPhaseCounts(): Record<ProductionGrowthPhase, number> {
  return {
    sous_mere: 0,
    transition: 0,
    starter: 0,
    growth: 0,
    fattening: 0
  };
}

@Injectable()
export class FeedPurchaseForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async computeStockPredictions(
    farmId: string
  ): Promise<FarmPredictionsPayload["stock_predictions"] | null> {
    const feedTypes = await this.prisma.feedType.findMany({
      where: { farmId },
      orderBy: { name: "asc" }
    });
    if (feedTypes.length === 0) {
      return null;
    }

    const [profitability, alertSettings, gmqRows] = await Promise.all([
      this.prisma.farmProfitabilitySettings.findUnique({ where: { farmId } }),
      this.prisma.farmAlertSettings.findUnique({ where: { farmId } }),
      this.prisma.farmGmqSettings.findMany({ where: { farmId } })
    ]);

    const gmqByKey = new Map(gmqRows.map((r) => [r.categoryKey, r]));
    const standards = buildGrowthStandardsFromFarm({
      gmqRefStarter: decimalToNum(profitability?.gmqRefStarter),
      gmqRefGrowth: decimalToNum(profitability?.gmqRefGrowth),
      gmqRefFattening: decimalToNum(profitability?.gmqRefFattening),
      gmqTargetStarter: gmqByKey.get("starter")?.targetGmqGPerDay?.toNumber(),
      gmqTargetGrowth: gmqByKey.get("growth")?.targetGmqGPerDay?.toNumber(),
      gmqTargetFattening:
        gmqByKey.get("finishing")?.targetGmqGPerDay?.toNumber() ??
        gmqByKey.get("fattening")?.targetGmqGPerDay?.toNumber(),
      starterMaxAvgWeightKg: alertSettings?.starterMaxAvgWeightKg?.toNumber(),
      starterMaxAvgAgeWeeks: alertSettings?.starterMaxAvgAgeWeeks
    });

    const ic: IcTargets = profitability
      ? {
          starter:
            decimalToNum(profitability.icTargetStarter) || DEFAULT_IC_TARGETS.starter,
          growth:
            decimalToNum(profitability.icTargetGrowth) || DEFAULT_IC_TARGETS.growth,
          fattening:
            decimalToNum(profitability.icTargetFattening) ||
            DEFAULT_IC_TARGETS.fattening
        }
      : DEFAULT_IC_TARGETS;

    const effectivePhases = new Map<string, FeedProductionPhase>();
    for (const ft of feedTypes) {
      effectivePhases.set(
        ft.id,
        effectiveFeedPhase(ft.productionPhase, ft.name)
      );
    }

    const observedByType = new Map<
      string,
      { daily: number | null; trend: number }
    >();
    for (const ft of feedTypes) {
      const [metrics, recentChecks] = await Promise.all([
        computeFeedStockMetrics(this.prisma, farmId, ft.id, {
          criticalDays: alertSettings?.stockCriticalDays ?? 7,
          warningDays: alertSettings?.stockWarningDays ?? 15
        }),
        this.prisma.feedStockMovement.findMany({
          where: {
            farmId,
            feedTypeId: ft.id,
            kind: FeedMovementKind.stock_check,
            dailyConsumptionKg: { not: null }
          },
          orderBy: { occurredAt: "asc" },
          take: 6,
          select: { dailyConsumptionKg: true }
        })
      ]);
      const rates = recentChecks
        .map((c) => c.dailyConsumptionKg?.toNumber())
        .filter((n): n is number => n != null && n > 0);
      observedByType.set(ft.id, {
        daily: metrics.avgDailyConsumptionKg,
        trend: estimateConsumptionTrendPer30d(rates)
      });
    }

    const totalObserved = [...observedByType.values()].reduce(
      (s, v) => s + (v.daily ?? 0),
      0
    );

    const inputs: FeedTypeForecastInput[] = feedTypes.map((ft) => {
      const obs = observedByType.get(ft.id);
      const observedDaily = obs?.daily ?? null;
      const share =
        totalObserved > 0 && observedDaily != null
          ? observedDaily / totalObserved
          : 1 / feedTypes.length;

      return {
        id: ft.id,
        name: ft.name,
        productionPhase: ft.productionPhase,
        currentStockKg: decimalToNum(ft.currentStockKg),
        observedDailyKg: observedDaily,
        consumptionTrendPer30d: obs?.trend ?? 0,
        historicalShare: share,
        unitPricePerKg: ft.currentPumpPrice
          ? decimalToNum(ft.currentPumpPrice)
          : null
      };
    });

    const phaseSeries = await this.buildPhaseHeadcountSeries(
      farmId,
      standards,
      FORECAST_DAYS
    );

    return buildFeedPurchaseForecast({
      feedTypes: inputs,
      phaseSeries,
      standards,
      ic,
      effectivePhases,
      warningDays: alertSettings?.stockWarningDays ?? 15
    });
  }

  private async buildPhaseHeadcountSeries(
    farmId: string,
    standards: typeof DEFAULT_GROWTH_STANDARDS,
    maxDays: number
  ): Promise<PhaseHeadcountSeries> {
    const [animals, batches] = await Promise.all([
      this.prisma.animal.findMany({
        where: { farmId, status: "active" },
        select: {
          birthDate: true,
          ageWeeksAtEntry: true,
          entryDate: true,
          entryWeightKg: true,
          productionCategory: true,
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
          headcount: true,
          categoryKey: true,
          avgBirthDate: true
        }
      })
    ]);

    const series: PhaseHeadcountSeries = new Map();
    const now = Date.now();

    for (let day = 0; day <= maxDays; day += 1) {
      const refDate = new Date(now + day * MS_DAY);
      const counts = emptyPhaseCounts();

      for (const batch of batches) {
        const avgAgeWeeks = batch.avgBirthDate
          ? calculateAnimalAgeWeeks(
              {
                birthDate: batch.avgBirthDate,
                ageWeeksAtEntry: null,
                entryDate: null
              },
              refDate
            )
          : null;
        const phase = resolveBatchFeedPhaseFromStandards(
          { categoryKey: batch.categoryKey, avgAgeWeeks },
          standards
        );
        counts[phase] += batch.headcount;
      }

      for (const animal of animals) {
        const cat = (animal.productionCategory ?? "").toLowerCase();
        if (cat === "breeding_female" || cat === "breeding_male") {
          continue;
        }

        const growthInput = {
          birthDate: animal.birthDate,
          ageWeeksAtEntry: animal.ageWeeksAtEntry,
          entryDate: animal.entryDate,
          entryWeightKg: animal.entryWeightKg
            ? decimalToNum(animal.entryWeightKg)
            : null,
          lastWeightKg: animal.weights[0]
            ? decimalToNum(animal.weights[0].weightKg)
            : null,
          lastWeightAt: animal.weights[0]?.measuredAt ?? null,
          productionCategory: animal.productionCategory
        };

        let productionCat = animal.productionCategory;
        const auto = resolveAutoProductionCategory(
          growthInput,
          refDate,
          standards
        );
        if (auto) {
          productionCat = auto;
        }

        const ageWeeks = calculateAnimalAgeWeeks(
          {
            birthDate: animal.birthDate,
            ageWeeksAtEntry: animal.ageWeeksAtEntry,
            entryDate: animal.entryDate
          },
          refDate
        );
        const phase = resolveProductionGrowthPhase(
          ageWeeks,
          productionCat,
          standards
        );
        counts[phase] += 1;
      }

      series.set(day, counts);
    }

    return series;
  }
}
