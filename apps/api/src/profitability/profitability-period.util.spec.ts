import { pct, resolvePeriodBounds, safeDiv } from "./profitability-period.util";

describe("profitability-period.util", () => {
  it("résout le mois en cours", () => {
    const bounds = resolvePeriodBounds("current_month");
    expect(bounds.start.getUTCDate()).toBe(1);
    expect(bounds.end.getTime()).toBeGreaterThan(bounds.start.getTime());
  });

  it("calcule un pourcentage", () => {
    expect(pct(25, 100)).toBe(25);
    expect(pct(25, 0)).toBeNull();
  });

  it("divise en sécurité", () => {
    expect(safeDiv(10, 2)).toBe(5);
    expect(safeDiv(10, 0)).toBeNull();
  });
});
