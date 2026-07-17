import {
  computeZScore,
  isOvermortality
} from "./region-stats-zscore.util";

describe("region-stats-zscore.util", () => {
  it("calcule un z-score positif sur série synthétique", () => {
    const historical = [10, 10, 12, 11, 10, 9, 10, 11];
    const z = computeZScore(25, historical);
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(2);
    expect(isOvermortality(z)).toBe(true);
  });

  it("retourne un z-score proche de zéro si la valeur est dans la norme", () => {
    const historical = [10, 10, 12, 11, 10, 9, 10, 11];
    const z = computeZScore(10, historical);
    expect(z).not.toBeNull();
    expect(Math.abs(z!)).toBeLessThan(1);
    expect(isOvermortality(z)).toBe(false);
  });

  it("gère une série historique vide", () => {
    expect(computeZScore(5, [])).toBeNull();
    expect(isOvermortality(null)).toBe(false);
  });
});
