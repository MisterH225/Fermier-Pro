import {
  canRequestWeightArbitration,
  computeWeightDifferenceKg,
  isWithinWeightTolerance,
  normalizeWeightArbitrationThresholds
} from "./weight-arbitration.util";

describe("weight-arbitration.util", () => {
  const thresholds = { minDiffKg: 1, cumulativeMinDiffKg: 5 };

  it("computes absolute difference", () => {
    expect(computeWeightDifferenceKg(100, 98)).toBe(2);
    expect(computeWeightDifferenceKg(98, 100)).toBe(2);
  });

  it("treats gaps below minDiffKg as within tolerance", () => {
    expect(isWithinWeightTolerance(0.5, thresholds)).toBe(true);
    expect(isWithinWeightTolerance(1, thresholds)).toBe(false);
  });

  it("requires cumulative threshold for multi-animal arbitration", () => {
    expect(canRequestWeightArbitration(2, 1, thresholds)).toBe(true);
    expect(canRequestWeightArbitration(2, 3, thresholds)).toBe(false);
    expect(canRequestWeightArbitration(5, 3, thresholds)).toBe(true);
  });

  it("normalizes platform settings defaults", () => {
    expect(normalizeWeightArbitrationThresholds(null)).toEqual({
      minDiffKg: 1,
      cumulativeMinDiffKg: 5
    });
    expect(
      normalizeWeightArbitrationThresholds({
        marketplaceWeightArbitrationMinDiffKg: 2,
        marketplaceWeightArbitrationCumulativeMinDiffKg: 8
      })
    ).toEqual({ minDiffKg: 2, cumulativeMinDiffKg: 8 });
  });
});
