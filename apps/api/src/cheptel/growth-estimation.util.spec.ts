import {
  buildGrowthStandardsFromFarm,
  estimateAnimalWeightKg,
  resolveAutoProductionCategory,
  resolveProductionGrowthPhase
} from "./growth-estimation.util";

describe("growth-estimation.util", () => {
  const standards = buildGrowthStandardsFromFarm({
    gmqRefStarter: 300,
    gmqRefGrowth: 450,
    gmqRefFattening: 650,
    starterMaxAvgWeightKg: 30,
    starterMaxAvgAgeWeeks: 10
  });

  it("progression de phase selon l'âge", () => {
    expect(resolveProductionGrowthPhase(2, "starter", standards)).toBe("sous_mere");
    expect(resolveProductionGrowthPhase(4, "starter", standards)).toBe("transition");
    expect(resolveProductionGrowthPhase(8, "starter", standards)).toBe("starter");
    expect(resolveProductionGrowthPhase(15, "starter", standards)).toBe("growth");
    expect(resolveProductionGrowthPhase(25, "fattening", standards)).toBe("fattening");
  });

  it("estime le poids depuis l'entrée avec GMQ hebdomadaire", () => {
    const entryDate = new Date("2026-01-01T00:00:00.000Z");
    const ref = new Date("2026-02-01T00:00:00.000Z");
    const weight = estimateAnimalWeightKg(
      {
        ageWeeksAtEntry: 8,
        entryDate,
        entryWeightKg: 20,
        productionCategory: "starter"
      },
      ref,
      standards
    );
    expect(weight).not.toBeNull();
    expect(weight!).toBeGreaterThan(20);
  });

  it("reclasse starter → fattening au-delà du seuil d'âge", () => {
    const entryDate = new Date("2025-10-01T00:00:00.000Z");
    const ref = new Date("2026-02-01T00:00:00.000Z");
    expect(
      resolveAutoProductionCategory(
        {
          ageWeeksAtEntry: 4,
          entryDate,
          entryWeightKg: 12,
          productionCategory: "starter"
        },
        ref,
        standards
      )
    ).toBe("fattening");
  });

  it("respecte l'âge à l'entrée pour un sujet acheté en engraissement", () => {
    const entryDate = new Date("2026-01-01T00:00:00.000Z");
    const ref = new Date("2026-01-15T00:00:00.000Z");
    expect(
      resolveProductionGrowthPhase(
        18,
        "fattening",
        standards
      )
    ).toBe("fattening");
    const w = estimateAnimalWeightKg(
      {
        ageWeeksAtEntry: 18,
        entryDate,
        entryWeightKg: 80,
        productionCategory: "fattening"
      },
      ref,
      standards
    );
    expect(w).toBeGreaterThan(80);
  });
});
