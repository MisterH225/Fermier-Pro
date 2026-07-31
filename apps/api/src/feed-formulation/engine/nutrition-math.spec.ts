import {
  blendNutrition,
  evaluateDeviations,
  lysineEnergyCoeff,
  lysinePerMcal
} from "./nutrition-math";
import type { RequirementProfileSnapshot } from "./feed-formulation.types";

describe("nutrition-math", () => {
  it("lysinePerMcal = 10000 × lys% / EM", () => {
    expect(lysinePerMcal(0.8, 3200)).toBeCloseTo(2.5, 6);
    expect(lysinePerMcal(1, 0)).toBeNull();
  });

  it("lysineEnergyCoeff positif si ratio > cible", () => {
    // lys 2.7 %, ME 3200 → ratio = 8.4375 ; cible 2.6 → coeff > 0
    expect(lysineEnergyCoeff(2.7, 3200, 2.6)).toBeGreaterThan(0);
    // maïs lys 0.25 / 3300 → ratio ≈ 0.76 < 2.6 → coeff < 0
    expect(lysineEnergyCoeff(0.25, 3300, 2.6)).toBeLessThan(0);
  });

  it("blendNutrition pondère correctement", () => {
    const n = blendNutrition(
      { a: 0.5, b: 0.5 },
      {
        a: {
          feedIngredientId: "a",
          crudeProteinPct: 10,
          metabolizableEnergyKcal: 3000,
          lysinePct: 0.4,
          methioninePct: 0.2,
          calciumPct: 0.1,
          phosphorusPct: 0.2,
          crudeFiberPct: 2
        },
        b: {
          feedIngredientId: "b",
          crudeProteinPct: 30,
          metabolizableEnergyKcal: 2000,
          lysinePct: 1.6,
          methioninePct: 0.4,
          calciumPct: 0.5,
          phosphorusPct: 0.6,
          crudeFiberPct: 6
        }
      }
    );
    expect(n.crudeProteinPct).toBeCloseTo(20);
    expect(n.metabolizableEnergyKcal).toBeCloseTo(2500);
    expect(n.lysinePct).toBeCloseTo(1.0);
  });

  it("evaluateDeviations détecte hors bornes", () => {
    const profile: RequirementProfileSnapshot = {
      stage: "finishing",
      minCrudeProteinPct: 13,
      maxCrudeProteinPct: 16,
      minMetabolizableEnergyKcal: 2900,
      maxMetabolizableEnergyKcal: 3100,
      minLysinePct: 0.68,
      minMethioninePct: 0.22,
      minCalciumPct: 0.55,
      maxCalciumPct: 0.85,
      minPhosphorusPct: 0.4,
      maxFiberPct: 6.5,
      minLysinePerMcal: 2.4,
      targetDailyIntakeKg: 2.9,
      fixedInclusions: []
    };
    const bad = evaluateDeviations(profile, {
      crudeProteinPct: 14,
      metabolizableEnergyKcal: 3400,
      lysinePct: 0.7,
      methioninePct: 0.25,
      calciumPct: 0.6,
      phosphorusPct: 0.5,
      crudeFiberPct: 4,
      lysinePerMcal: 2.0
    });
    const energy = bad.find((d) => d.nutrient === "metabolizableEnergyKcal" && d.target.startsWith("≤"));
    expect(energy?.withinBounds).toBe(false);
    const ratio = bad.find((d) => d.nutrient === "lysinePerMcal");
    expect(ratio?.withinBounds).toBe(false);
  });
});
