import {
  averageRetainedWeightKg,
  canRequestWeightArbitration,
  computeWeightDifferenceKg,
  effectiveWeightToleranceKg,
  isWithinWeightTolerance,
  normalizeWeightArbitrationThresholds
} from "./weight-arbitration.util";
import { calculateFinalAmount } from "./transaction.utils";
import { MarketplacePriceType } from "@prisma/client";

describe("weight-arbitration.util", () => {
  const thresholds = {
    minDiffKg: 1,
    cumulativeMinDiffKg: 5,
    tolerancePercent: 3
  };

  it("computes absolute difference", () => {
    expect(computeWeightDifferenceKg(100, 98)).toBe(2);
    expect(computeWeightDifferenceKg(98, 100)).toBe(2);
  });

  it("porcelet 15 kg : le plancher kg domine (3 % = 0,45 kg)", () => {
    expect(effectiveWeightToleranceKg(15, thresholds)).toBe(1);
    // écart 0,8 kg ≤ 1 kg → toléré
    expect(isWithinWeightTolerance(15, 15.8, thresholds)).toBe(true);
    // écart 1,2 kg > 1 kg → hors tolérance
    expect(isWithinWeightTolerance(15, 16.2, thresholds)).toBe(false);
  });

  it("gros porc 120 kg : le % domine (3 % = 3,6 kg)", () => {
    expect(effectiveWeightToleranceKg(120, thresholds)).toBe(3.6);
    expect(isWithinWeightTolerance(120, 123, thresholds)).toBe(true);
    expect(isWithinWeightTolerance(120, 124, thresholds)).toBe(false);
  });

  it("accepte l'écart exact à la tolérance et l'écart 0", () => {
    expect(isWithinWeightTolerance(100, 103, thresholds)).toBe(true); // 3 % = 3
    expect(isWithinWeightTolerance(100, 100, thresholds)).toBe(true);
  });

  it("refuse auto-validation si poids acheteur nul", () => {
    expect(isWithinWeightTolerance(0, 100, thresholds)).toBe(false);
    expect(isWithinWeightTolerance(-1, 100, thresholds)).toBe(false);
  });

  it("moyenne arrondie à 4 décimales", () => {
    expect(averageRetainedWeightKg(100, 101)).toBe(100.5);
    expect(averageRetainedWeightKg(10, 10.33333)).toBe(10.1667);
  });

  it("requires cumulative threshold for multi-animal arbitration", () => {
    expect(canRequestWeightArbitration(2, 1, thresholds, 100)).toBe(false); // ≤ 3 %
    expect(canRequestWeightArbitration(4, 1, thresholds, 100)).toBe(true);
    expect(canRequestWeightArbitration(4, 3, thresholds, 100)).toBe(false);
    expect(canRequestWeightArbitration(5, 3, thresholds, 100)).toBe(true);
  });

  it("normalizes platform settings defaults including percent", () => {
    expect(normalizeWeightArbitrationThresholds(null)).toEqual({
      minDiffKg: 1,
      cumulativeMinDiffKg: 5,
      tolerancePercent: 3
    });
    expect(
      normalizeWeightArbitrationThresholds({
        marketplaceWeightArbitrationMinDiffKg: 2,
        marketplaceWeightArbitrationCumulativeMinDiffKg: 8,
        marketplaceWeightTolerancePercent: 4
      })
    ).toEqual({ minDiffKg: 2, cumulativeMinDiffKg: 8, tolerancePercent: 4 });
  });

  it("montant settle identique auto-moyenne vs validation manuelle au même poids", () => {
    const retained = averageRetainedWeightKg(100, 102);
    const perKg = { toNumber: () => 1800 };
    const auto = calculateFinalAmount({
      priceType: MarketplacePriceType.per_kg,
      agreedPricePerKg: perKg,
      agreedFlatPrice: null,
      realWeightKg: { toNumber: () => retained },
      arbitrationWeightKg: null
    });
    const manual = calculateFinalAmount({
      priceType: MarketplacePriceType.per_kg,
      agreedPricePerKg: perKg,
      agreedFlatPrice: null,
      realWeightKg: { toNumber: () => retained },
      arbitrationWeightKg: null
    });
    expect(auto).toBe(manual);
    expect(auto).toBe(retained * 1800);
  });
});
