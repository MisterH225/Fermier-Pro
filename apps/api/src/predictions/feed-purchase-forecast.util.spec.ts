import type { ProductionGrowthPhase } from "../cheptel/growth-estimation.types";
import { DEFAULT_GROWTH_STANDARDS } from "../cheptel/growth-estimation.types";
import {
  blendDailyConsumptionKg,
  buildFeedPurchaseForecast,
  dailyDemandKgByPhase,
  estimateConsumptionTrendPer30d,
  icForGrowthPhase,
  mapPhaseDemandToFeedTypes
} from "./feed-purchase-forecast.util";

describe("feed-purchase-forecast.util", () => {
  const standards = DEFAULT_GROWTH_STANDARDS;
  const ic = { starter: 1.8, growth: 2.2, fattening: 2.8 };

  it("estime une tendance de consommation", () => {
    expect(estimateConsumptionTrendPer30d([10, 12])).toBeCloseTo(0.2, 2);
    expect(estimateConsumptionTrendPer30d([10])).toBe(0);
  });

  it("augmente la demande quand le cheptel passe en engraissement", () => {
    const starterOnly: Record<ProductionGrowthPhase, number> = {
      sous_mere: 0,
      transition: 0,
      starter: 100,
      growth: 0,
      fattening: 0
    };
    const fatteningOnly: Record<ProductionGrowthPhase, number> = {
      sous_mere: 0,
      transition: 0,
      starter: 0,
      growth: 0,
      fattening: 100
    };

    const dStarter = dailyDemandKgByPhase(starterOnly, standards, ic);
    const dFat = dailyDemandKgByPhase(fatteningOnly, standards, ic);

    expect(dFat.fattening).toBeGreaterThan(dStarter.starter);
  });

  it("ne recommande pas de commande si le stock couvre la fenêtre d’alerte", () => {
    const phaseSeries = new Map<number, Record<ProductionGrowthPhase, number>>();
    phaseSeries.set(0, {
      sous_mere: 0,
      transition: 0,
      starter: 50,
      growth: 0,
      fattening: 0
    });

    const result = buildFeedPurchaseForecast({
      feedTypes: [
        {
          id: "ft1",
          name: "Démarrage",
          productionPhase: "starter",
          currentStockKg: 5000,
          observedDailyKg: 20,
          consumptionTrendPer30d: 0,
          historicalShare: 1,
          unitPricePerKg: 100
        }
      ],
      phaseSeries,
      standards,
      ic,
      effectivePhases: new Map([["ft1", "starter"]]),
      warningDays: 15
    });

    expect(result.feed_needs[0]!.reorder_quantity_kg).toBe(0);
  });

  it("recommande une commande limitée quand le stock est bas", () => {
    const phaseSeries = new Map<number, Record<ProductionGrowthPhase, number>>();
    for (let d = 0; d <= 90; d += 1) {
      phaseSeries.set(d, {
        sous_mere: 0,
        transition: 0,
        starter: 0,
        growth: 0,
        fattening: 100
      });
    }

    const result = buildFeedPurchaseForecast({
      feedTypes: [
        {
          id: "ft2",
          name: "Engraissement",
          productionPhase: "fattening",
          currentStockKg: 200,
          observedDailyKg: 80,
          consumptionTrendPer30d: 0.05,
          historicalShare: 1,
          unitPricePerKg: 120
        }
      ],
      phaseSeries,
      standards,
      ic,
      effectivePhases: new Map([["ft2", "fattening"]]),
      warningDays: 15
    });

    const row = result.feed_needs[0]!;
    expect(row.reorder_quantity_kg).toBeGreaterThan(0);
    expect(row.reorder_quantity_kg).toBeLessThanOrEqual(row.needed_30j_kg);
    expect(row.needed_90j_kg).toBeGreaterThan(row.needed_30j_kg);
  });

  it("fusionne cheptel et conso observée", () => {
    const blended = blendDailyConsumptionKg(100, 50, 0, 0);
    expect(blended).toBeCloseTo(77.5, 1);
  });

  it("mappe la demande vers le bon type d’aliment", () => {
    const demand = dailyDemandKgByPhase(
      {
        sous_mere: 0,
        transition: 0,
        starter: 0,
        growth: 0,
        fattening: 50
      },
      standards,
      ic
    );
    const mapped = mapPhaseDemandToFeedTypes(
      demand,
      [
        {
          id: "a",
          name: "Finisher",
          productionPhase: "fattening",
          currentStockKg: 0,
          observedDailyKg: null,
          consumptionTrendPer30d: 0,
          historicalShare: 1,
          unitPricePerKg: null
        }
      ],
      new Map([["a", "fattening"]])
    );
    expect(mapped.get("a") ?? 0).toBeGreaterThan(0);
  });

  it("IC croît avec la phase", () => {
    expect(icForGrowthPhase("fattening", ic)).toBeGreaterThan(
      icForGrowthPhase("starter", ic)
    );
  });
});
