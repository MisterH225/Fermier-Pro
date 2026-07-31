import { FEED_REQUIREMENTS_SEED } from "../../prisma/seed-data/feed-requirements";

describe("FEED_REQUIREMENTS_SEED", () => {
  it("couvre les 6 stades ProductionStage", () => {
    const stages = FEED_REQUIREMENTS_SEED.map((r) => r.stage).sort();
    expect(stages).toEqual(
      [
        "fattening",
        "finishing",
        "gestating_sow",
        "growing",
        "lactating_sow",
        "piglet_weaning"
      ].sort()
    );
  });

  it("encode l'anti-gras sur fattening et finishing", () => {
    for (const stage of ["fattening", "finishing"] as const) {
      const row = FEED_REQUIREMENTS_SEED.find((r) => r.stage === stage)!;
      expect(row.maxMetabolizableEnergyKcal).toBeDefined();
      expect(row.minLysinePerMcal).toBeDefined();
      expect(row.minLysinePerMcal!).toBeGreaterThan(0);
      expect(row.notes).toMatch(/anti-gras|nutritionniste/i);
    }
  });

  it("borne min ≤ max quand max est défini", () => {
    for (const row of FEED_REQUIREMENTS_SEED) {
      if (row.maxCrudeProteinPct != null) {
        expect(row.maxCrudeProteinPct).toBeGreaterThanOrEqual(row.minCrudeProteinPct);
      }
      if (row.maxMetabolizableEnergyKcal != null) {
        expect(row.maxMetabolizableEnergyKcal).toBeGreaterThanOrEqual(
          row.minMetabolizableEnergyKcal
        );
      }
    }
  });

  it("chaque stade prescrit CMV + sel en taux fixes (indicatif)", () => {
    for (const row of FEED_REQUIREMENTS_SEED) {
      expect(row.fixedInclusionsByName.length).toBeGreaterThan(0);
      const names = row.fixedInclusionsByName.map((f) => f.canonicalName);
      expect(names).toEqual(
        expect.arrayContaining([
          "Complément minéral vitaminé (CMV)",
          "Sel"
        ])
      );
      const sum = row.fixedInclusionsByName.reduce(
        (s, f) => s + f.inclusionPct,
        0
      );
      expect(sum).toBeGreaterThan(0);
      expect(sum).toBeLessThanOrEqual(5);
      expect(row.notes).toMatch(/nutritionniste/i);
    }
  });
});
