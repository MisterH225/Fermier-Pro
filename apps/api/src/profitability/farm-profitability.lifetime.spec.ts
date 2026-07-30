import { buildMetricsForTest } from "./farm-profitability.calculator";

/**
 * Garde-fous sur le dénominateur lifetime :
 * coûts totaux (app + pré-app) / kg tous temps — jamais kg de la période.
 */
describe("lifetime costPerKg denominator", () => {
  it("utilise les kg tous temps, pas les kg du mois", () => {
    const lifetimeCosts = 4_500_000;
    const monthKg = 108.5; // ≈ 41 452 FCFA/kg si mauvais dénominateur
    const allTimeKg = 4625; // ≈ 973 FCFA/kg

    const wrong = buildMetricsForTest({
      revenues: 500_000,
      costsDirect: lifetimeCosts * 0.7,
      costsIndirect: lifetimeCosts * 0.3,
      kgProduced: monthKg
    });
    const correct = buildMetricsForTest({
      revenues: 500_000,
      costsDirect: lifetimeCosts * 0.7,
      costsIndirect: lifetimeCosts * 0.3,
      kgProduced: allTimeKg
    });

    expect(wrong.costPerKg!).toBeGreaterThan(40_000);
    expect(correct.costPerKg!).toBeLessThan(1_500);
    expect(correct.breakevenPricePerKg).toBe(correct.costPerKg);
  });
});
