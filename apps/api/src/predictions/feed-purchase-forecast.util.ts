import type { FeedProductionPhase } from "@prisma/client";
import type { ProductionGrowthPhase } from "../cheptel/growth-estimation.types";
import type { GrowthStandards } from "../cheptel/growth-estimation.types";
import { feedPhasesCompatible } from "../feed-stock/feed-production-phase.util";
import type { FarmPredictionsPayload, PredictionHorizonKey } from "./prediction.types";

const MS_DAY = 86_400_000;
const HORIZONS: PredictionHorizonKey[] = ["30j", "60j", "90j"];
const HORIZON_DAYS: Record<PredictionHorizonKey, number> = {
  "30j": 30,
  "60j": 60,
  "90j": 90
};

export type FeedTypeForecastInput = {
  id: string;
  name: string;
  productionPhase: FeedProductionPhase;
  currentStockKg: number;
  /** Consommation observée (contrôles stock), kg/j. */
  observedDailyKg: number | null;
  /** Pente relative de conso / 30 jours (ex. 0.1 = +10 % sur 30 j). */
  consumptionTrendPer30d: number;
  /** Part historique de ce type parmi les aliments compatibles (0–1). */
  historicalShare: number;
  unitPricePerKg: number | null;
};

export type PhaseHeadcountSeries = Map<number, Record<ProductionGrowthPhase, number>>;

export type IcTargets = {
  starter: number;
  growth: number;
  fattening: number;
};

export const DEFAULT_IC_TARGETS: IcTargets = {
  starter: 1.8,
  growth: 2.2,
  fattening: 2.8
};

function growthPhaseToFeedPhase(
  phase: ProductionGrowthPhase
): FeedProductionPhase {
  return phase as FeedProductionPhase;
}

/** IC (kg aliment / kg gain) selon la phase de croissance. */
export function icForGrowthPhase(
  phase: ProductionGrowthPhase,
  ic: IcTargets
): number {
  switch (phase) {
    case "sous_mere":
      return ic.starter * 0.65;
    case "transition":
      return ic.starter * 0.85;
    case "starter":
      return ic.starter;
    case "growth":
      return ic.growth;
    case "fattening":
      return ic.fattening;
    default:
      return ic.growth;
  }
}

/** Besoin journalier théorique (kg) pour une phase à partir du cheptel simulé. */
export function dailyDemandKgByPhase(
  headcount: Record<ProductionGrowthPhase, number>,
  standards: GrowthStandards,
  ic: IcTargets
): Record<ProductionGrowthPhase, number> {
  const out = {} as Record<ProductionGrowthPhase, number>;
  const phases: ProductionGrowthPhase[] = [
    "sous_mere",
    "transition",
    "starter",
    "growth",
    "fattening"
  ];
  for (const phase of phases) {
    const heads = headcount[phase] ?? 0;
    if (heads <= 0) {
      out[phase] = 0;
      continue;
    }
    const gmqKgPerDay = standards.gmqGPerDay[phase] / 1000;
    out[phase] = heads * icForGrowthPhase(phase, ic) * gmqKgPerDay;
  }
  return out;
}

/** Répartit la demande par phase vers les types d'aliment compatibles. */
export function mapPhaseDemandToFeedTypes(
  demandByPhase: Record<ProductionGrowthPhase, number>,
  feedTypes: FeedTypeForecastInput[],
  effectivePhases: Map<string, FeedProductionPhase>
): Map<string, number> {
  const out = new Map<string, number>();

  for (const ft of feedTypes) {
    const feedPhase = effectivePhases.get(ft.id) ?? ft.productionPhase;
    if (feedPhase === "unknown" || feedPhase === "breeder") {
      out.set(ft.id, 0);
      continue;
    }
    let raw = 0;
    const phases: ProductionGrowthPhase[] = [
      "sous_mere",
      "transition",
      "starter",
      "growth",
      "fattening"
    ];
    for (const gp of phases) {
      const fp = growthPhaseToFeedPhase(gp);
      if (feedPhasesCompatible(feedPhase, fp)) {
        raw += demandByPhase[gp] ?? 0;
      }
    }
    out.set(ft.id, raw * Math.max(0, ft.historicalShare));
  }

  return out;
}

/** Pente de consommation à partir des taux journaliers des derniers contrôles. */
export function estimateConsumptionTrendPer30d(
  dailyRates: number[]
): number {
  if (dailyRates.length < 2) {
    return 0;
  }
  const first = dailyRates[0]!;
  const last = dailyRates[dailyRates.length - 1]!;
  if (first <= 0) {
    return 0;
  }
  const relative = (last - first) / first;
  return Math.max(-0.5, Math.min(0.5, relative));
}

function observedDailyAtDay(
  base: number,
  trendPer30d: number,
  day: number
): number {
  const factor = 1 + (trendPer30d * day) / 30;
  return Math.max(0, base * factor);
}

/** Fusionne demande cheptel (IC×GMQ×effectif) et conso observée. */
export function blendDailyConsumptionKg(
  cheptelDaily: number,
  observedDaily: number | null,
  trendPer30d: number,
  day: number
): number {
  const obs =
    observedDaily != null && observedDaily > 0
      ? observedDailyAtDay(observedDaily, trendPer30d, day)
      : 0;
  const cheptel = Math.max(0, cheptelDaily);

  if (cheptel > 0 && obs > 0) {
    return cheptel * 0.55 + obs * 0.45;
  }
  if (cheptel > 0) {
    return cheptel;
  }
  return obs;
}

function integrateConsumption(
  dailyFn: (day: number) => number,
  days: number
): number {
  let sum = 0;
  for (let d = 0; d < days; d += 1) {
    sum += dailyFn(d);
  }
  return sum;
}

function isoDateFromToday(offsetDays: number, now = new Date()): string {
  const d = new Date(now.getTime() + offsetDays * MS_DAY);
  return d.toISOString().slice(0, 10);
}

export type BuildFeedNeedsParams = {
  feedTypes: FeedTypeForecastInput[];
  phaseSeries: PhaseHeadcountSeries;
  standards: GrowthStandards;
  ic: IcTargets;
  effectivePhases: Map<string, FeedProductionPhase>;
  warningDays: number;
  now?: Date;
};

export function buildFeedPurchaseForecast(
  params: BuildFeedNeedsParams
): FarmPredictionsPayload["stock_predictions"] {
  const now = params.now ?? new Date();
  const feedNeeds: FarmPredictionsPayload["stock_predictions"]["feed_needs"] =
    [];
  let totalCost30 = 0;
  let totalCost60 = 0;
  let totalCost90 = 0;

  for (const ft of params.feedTypes) {
    const dailyFn = (day: number) => {
      const headcount =
        params.phaseSeries.get(day) ??
        params.phaseSeries.get(0) ??
        ({} as Record<ProductionGrowthPhase, number>);
      const demandByPhase = dailyDemandKgByPhase(
        headcount,
        params.standards,
        params.ic
      );
      const cheptelDaily = mapPhaseDemandToFeedTypes(
        demandByPhase,
        [ft],
        params.effectivePhases
      ).get(ft.id) ?? 0;

      return blendDailyConsumptionKg(
        cheptelDaily,
        ft.observedDailyKg,
        ft.consumptionTrendPer30d,
        day
      );
    };

    const dailyNow = dailyFn(0);
    const needed30 = Math.max(
      0,
      integrateConsumption(dailyFn, HORIZON_DAYS["30j"]) - ft.currentStockKg
    );
    const needed60 = Math.max(
      0,
      integrateConsumption(dailyFn, HORIZON_DAYS["60j"]) - ft.currentStockKg
    );
    const needed90 = Math.max(
      0,
      integrateConsumption(dailyFn, HORIZON_DAYS["90j"]) - ft.currentStockKg
    );

    const daysCover =
      dailyNow > 0 ? ft.currentStockKg / dailyNow : Number.POSITIVE_INFINITY;

    let reorderQty = 0;
    if (Number.isFinite(daysCover) && daysCover < params.warningDays) {
      const targetStock = dailyNow * params.warningDays;
      reorderQty = Math.max(0, Math.ceil(targetStock - ft.currentStockKg));
      reorderQty = Math.min(reorderQty, needed30);
    }

    const depletionDays =
      dailyNow > 0
        ? Math.max(0, Math.floor(ft.currentStockKg / dailyNow))
        : null;
    const reorderLeadDays =
      daysCover > params.warningDays
        ? Math.max(0, Math.floor(daysCover - params.warningDays))
        : 0;

    const price = ft.unitPricePerKg ?? 0;
    totalCost30 += needed30 * price;
    totalCost60 += needed60 * price;
    totalCost90 += needed90 * price;

    feedNeeds.push({
      feed_type_id: ft.id,
      feed_type_name: ft.name,
      current_stock_kg: Math.round(ft.currentStockKg * 10) / 10,
      daily_consumption_kg: Math.round(dailyNow * 100) / 100,
      needed_30j_kg: Math.round(needed30),
      needed_60j_kg: Math.round(needed60),
      needed_90j_kg: Math.round(needed90),
      stock_depletion_date:
        depletionDays != null ? isoDateFromToday(depletionDays, now) : now.toISOString().slice(0, 10),
      reorder_recommended_date: isoDateFromToday(reorderLeadDays, now),
      reorder_quantity_kg: reorderQty
    });
  }

  return {
    feed_needs: feedNeeds,
    total_feed_cost_30j: Math.round(totalCost30),
    total_feed_cost_60j: Math.round(totalCost60),
    total_feed_cost_90j: Math.round(totalCost90)
  };
}

export { HORIZONS, HORIZON_DAYS };
