import {
  buildPeriodTotals,
  computeDeltaPct,
  decimalToNumber,
  periodPairsAt
} from "./buyer-dashboard.aggregations";

describe("buyer-dashboard.aggregations", () => {
  it("calcule les fenêtres mois / trimestre / année", () => {
    const now = new Date(2026, 6, 29, 12, 0, 0); // 29 juil. 2026
    const pairs = periodPairsAt(now);

    expect(pairs.month.current.start).toEqual(new Date(2026, 6, 1));
    expect(pairs.month.previous.start).toEqual(new Date(2026, 5, 1));
    expect(pairs.month.previous.end).toEqual(pairs.month.current.start);

    expect(pairs.quarter.current.start).toEqual(new Date(2026, 6, 1)); // Q3
    expect(pairs.quarter.previous.start).toEqual(new Date(2026, 3, 1)); // Q2

    expect(pairs.year.current.start).toEqual(new Date(2026, 0, 1));
    expect(pairs.year.previous.start).toEqual(new Date(2025, 0, 1));
  });

  it("computeDeltaPct gère zéro et arrondi", () => {
    expect(computeDeltaPct(110, 100)).toBe(10);
    expect(computeDeltaPct(0, 0)).toBe(0);
    expect(computeDeltaPct(50, 0)).toBeNull();
    expect(computeDeltaPct(80, 100)).toBe(-20);
  });

  it("buildPeriodTotals assemble les totaux", () => {
    expect(buildPeriodTotals(200, 100, 2, 1)).toEqual({
      total: 200,
      previousTotal: 100,
      count: 2,
      previousCount: 1,
      deltaPct: 100
    });
  });

  it("decimalToNumber accepte Decimal-like et number", () => {
    expect(decimalToNumber(42)).toBe(42);
    expect(decimalToNumber({ toNumber: () => 12.5 })).toBe(12.5);
    expect(decimalToNumber(null)).toBe(0);
  });
});
