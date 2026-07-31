import { FEED_REQUIREMENTS_SEED } from "../../../prisma/seed-data/feed-requirements";
import { JavascriptLpSolver } from "../solver/javascript-lp.solver";
import { createFeedFormulationEngine } from "../feed-formulation.service";
import type {
  FormulateInput,
  IngredientNutrition,
  RequirementProfileSnapshot
} from "./feed-formulation.types";
import { lysinePerMcal } from "./nutrition-math";

/**
 * Catalogue d'intrants de test (valeurs alignées seed FeedIngredient).
 * Identifiants stables pour déterminisme.
 */
const NUTRI: Record<string, IngredientNutrition> = {
  corn: {
    feedIngredientId: "corn",
    canonicalName: "Maïs jaune",
    crudeProteinPct: 8.5,
    metabolizableEnergyKcal: 3300,
    lysinePct: 0.25,
    methioninePct: 0.18,
    calciumPct: 0.02,
    phosphorusPct: 0.27,
    crudeFiberPct: 2.2
  },
  soy: {
    feedIngredientId: "soy",
    canonicalName: "Tourteau de soja",
    crudeProteinPct: 44,
    metabolizableEnergyKcal: 3200,
    lysinePct: 2.7,
    methioninePct: 0.6,
    calciumPct: 0.3,
    phosphorusPct: 0.65,
    crudeFiberPct: 6
  },
  bran: {
    feedIngredientId: "bran",
    canonicalName: "Son de blé",
    crudeProteinPct: 15.5,
    metabolizableEnergyKcal: 2300,
    lysinePct: 0.6,
    methioninePct: 0.23,
    calciumPct: 0.13,
    phosphorusPct: 1.15,
    crudeFiberPct: 10
  },
  fish: {
    feedIngredientId: "fish",
    canonicalName: "Farine de poisson",
    crudeProteinPct: 60,
    metabolizableEnergyKcal: 3000,
    lysinePct: 4.5,
    methioninePct: 1.7,
    calciumPct: 5,
    phosphorusPct: 3,
    crudeFiberPct: 1
  },
  oyster: {
    feedIngredientId: "oyster",
    canonicalName: "Coquilles d'huître",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 38,
    phosphorusPct: 0.1,
    crudeFiberPct: 0
  },
  dcp: {
    feedIngredientId: "dcp",
    canonicalName: "Phosphate bicalcique",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 23,
    phosphorusPct: 18,
    crudeFiberPct: 0
  },
  lys: {
    feedIngredientId: "lys",
    canonicalName: "Lysine",
    crudeProteinPct: 78,
    metabolizableEnergyKcal: 0,
    lysinePct: 78,
    methioninePct: 0,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0
  },
  met: {
    feedIngredientId: "met",
    canonicalName: "Méthionine",
    crudeProteinPct: 99,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 99,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0
  },
  /** Huile très énergétique — pour forcer le plafond anti-gras. */
  oil: {
    feedIngredientId: "oil",
    canonicalName: "Huile végétale",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 8500,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0
  },
  cmv: {
    feedIngredientId: "cmv",
    canonicalName: "Complément minéral vitaminé (CMV)",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 15,
    phosphorusPct: 5,
    crudeFiberPct: 0,
    isPremix: true
  },
  salt: {
    feedIngredientId: "salt",
    canonicalName: "Sel",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0,
    isPremix: true
  }
};

/** Map seed canonicalName → id de test stable. */
const NAME_TO_TEST_ID: Record<string, string> = {
  "Complément minéral vitaminé (CMV)": "cmv",
  Sel: "salt"
};

function profileOf(
  stage: RequirementProfileSnapshot["stage"],
  fixedOverride?: RequirementProfileSnapshot["fixedInclusions"]
): RequirementProfileSnapshot {
  const seed = FEED_REQUIREMENTS_SEED.find((r) => r.stage === stage);
  if (!seed) throw new Error(`seed manquant: ${stage}`);
  const fixedInclusions =
    fixedOverride ??
    seed.fixedInclusionsByName.map((f) => ({
      feedIngredientId: NAME_TO_TEST_ID[f.canonicalName] ?? f.canonicalName,
      inclusionPct: f.inclusionPct
    }));
  return {
    stage,
    minCrudeProteinPct: seed.minCrudeProteinPct,
    maxCrudeProteinPct: seed.maxCrudeProteinPct ?? null,
    minMetabolizableEnergyKcal: seed.minMetabolizableEnergyKcal,
    maxMetabolizableEnergyKcal: seed.maxMetabolizableEnergyKcal ?? null,
    minLysinePct: seed.minLysinePct,
    minMethioninePct: seed.minMethioninePct,
    minCalciumPct: seed.minCalciumPct,
    maxCalciumPct: seed.maxCalciumPct ?? null,
    minPhosphorusPct: seed.minPhosphorusPct,
    maxFiberPct: seed.maxFiberPct ?? null,
    minLysinePerMcal: seed.minLysinePerMcal ?? null,
    targetDailyIntakeKg: seed.targetDailyIntakeKg ?? null,
    fixedInclusions
  };
}

const FULL_PANEL = [
  "corn",
  "soy",
  "bran",
  "fish",
  "oyster",
  "dcp",
  "lys",
  "met",
  "oil",
  "cmv",
  "salt"
] as const;

function availableAll(
  ids: readonly string[] = FULL_PANEL,
  maxKg = 10_000,
  priceFn?: (id: string) => number
) {
  const prices: Record<string, number> = {
    corn: 200,
    soy: 450,
    bran: 150,
    fish: 800,
    oyster: 100,
    dcp: 350,
    lys: 2000,
    met: 2500,
    oil: 900,
    cmv: 1200,
    salt: 80
  };
  return ids.map((id) => ({
    feedIngredientId: id,
    pricePerKg: priceFn?.(id) ?? prices[id] ?? 300,
    maxAvailableKg: maxKg
  }));
}

function baseInput(
  stage: RequirementProfileSnapshot["stage"],
  overrides?: Partial<FormulateInput>
): FormulateInput {
  return {
    stage,
    animalCount: 10,
    avgWeightKg: stage === "piglet_weaning" ? 12 : stage.includes("sow") ? 180 : 60,
    durationDays: 7,
    availableIngredients: availableAll(),
    profile: profileOf(stage),
    nutritionById: { ...NUTRI },
    ...overrides
  };
}

describe("FeedFormulationEngine — formulation au moindre coût", () => {
  const engine = createFeedFormulationEngine(new JavascriptLpSolver());

  describe("faisabilité par stade (profil seed)", () => {
    it.each(FEED_REQUIREMENTS_SEED.map((r) => r.stage))(
      "stade %s → ration feasible respectant toutes les bornes",
      (stage) => {
        const result = engine.formulate(baseInput(stage));
        expect(result.infeasibilityReasons).toEqual([]);
        expect(result.feasible).toBe(true);
        expect(result.ration.length).toBeGreaterThan(0);
        expect(result.nutritionResult).not.toBeNull();
        expect(result.deviations.every((d) => d.withinBounds)).toBe(true);

        const n = result.nutritionResult!;
        const p = profileOf(stage);
        expect(n.crudeProteinPct).toBeGreaterThanOrEqual(p.minCrudeProteinPct - 1e-4);
        if (p.maxCrudeProteinPct != null) {
          expect(n.crudeProteinPct).toBeLessThanOrEqual(p.maxCrudeProteinPct + 1e-4);
        }
        expect(n.metabolizableEnergyKcal).toBeGreaterThanOrEqual(
          p.minMetabolizableEnergyKcal - 1e-4
        );
        if (p.maxMetabolizableEnergyKcal != null) {
          expect(n.metabolizableEnergyKcal).toBeLessThanOrEqual(
            p.maxMetabolizableEnergyKcal + 1e-4
          );
        }
        expect(n.lysinePct).toBeGreaterThanOrEqual(p.minLysinePct - 1e-4);
        expect(n.methioninePct).toBeGreaterThanOrEqual(p.minMethioninePct - 1e-4);
        expect(n.calciumPct).toBeGreaterThanOrEqual(p.minCalciumPct - 1e-4);
        expect(n.phosphorusPct).toBeGreaterThanOrEqual(p.minPhosphorusPct - 1e-4);
        if (p.maxFiberPct != null) {
          expect(n.crudeFiberPct).toBeLessThanOrEqual(p.maxFiberPct + 1e-4);
        }
        if (p.minLysinePerMcal != null) {
          const ratio = lysinePerMcal(n.lysinePct, n.metabolizableEnergyKcal);
          expect(ratio).not.toBeNull();
          expect(ratio!).toBeGreaterThanOrEqual(p.minLysinePerMcal - 1e-4);
        }

        const sumPct = result.ration.reduce((s, l) => s + l.proportionPct, 0);
        expect(sumPct).toBeGreaterThan(99.5);
        expect(sumPct).toBeLessThan(100.5);
        const sumQty = result.ration.reduce((s, l) => s + l.quantityKg, 0);
        expect(sumQty).toBeCloseTo(result.totalFeedKg, 2);
      }
    );
  });

  describe("contrainte anti-gras (finition / engraissement)", () => {
    it("finition : refuse une palette uniquement ultra-énergétique (huile+maïs)", () => {
      const result = engine.formulate(
        baseInput("finishing", {
          profile: profileOf("finishing", []),
          availableIngredients: availableAll(["corn", "oil", "oyster", "dcp"]),
          nutritionById: NUTRI
        })
      );
      // Sans protéine/lysine suffisantes OU avec EM trop haute → infaisable
      expect(result.feasible).toBe(false);
      expect(result.ration).toEqual([]);
      expect(result.infeasibilityReasons.length).toBeGreaterThan(0);
      expect(result.infeasibilityReasons.join(" ")).toMatch(
        /protéine|lysine|énergie|anti-gras|calor/i
      );
    });

    it("finition : ration feasible reste sous le plafond EM et ratio lysine/énergie", () => {
      const result = engine.formulate(baseInput("finishing"));
      expect(result.feasible).toBe(true);
      const n = result.nutritionResult!;
      const p = profileOf("finishing");
      expect(n.metabolizableEnergyKcal).toBeLessThanOrEqual(
        p.maxMetabolizableEnergyKcal! + 1e-4
      );
      const ratio = lysinePerMcal(n.lysinePct, n.metabolizableEnergyKcal)!;
      expect(ratio).toBeGreaterThanOrEqual(p.minLysinePerMcal! - 1e-4);
    });

    it("engraissement : plafond EM 3200 respecté", () => {
      const result = engine.formulate(baseInput("fattening"));
      expect(result.feasible).toBe(true);
      expect(result.nutritionResult!.metabolizableEnergyKcal).toBeLessThanOrEqual(
        3200 + 1e-4
      );
    });
  });

  describe("cas infaisable — diagnostic sans ration bancale", () => {
    it("sans source protéique → feasible=false + diagnostic protéine", () => {
      const result = engine.formulate(
        baseInput("growing", {
          availableIngredients: availableAll([
            "corn",
            "bran",
            "oyster",
            "dcp",
            "cmv",
            "salt"
          ])
        })
      );
      expect(result.feasible).toBe(false);
      expect(result.ration).toEqual([]);
      expect(result.nutritionResult).toBeNull();
      expect(result.infeasibilityReasons.join(" ")).toMatch(/protéine|lysine/i);
    });

    it("stock total insuffisant → message stock", () => {
      const result = engine.formulate(
        baseInput("growing", {
          animalCount: 100,
          durationDays: 30,
          availableIngredients: availableAll(FULL_PANEL, 5)
        })
      );
      expect(result.feasible).toBe(false);
      expect(result.ration).toEqual([]);
      expect(result.infeasibilityReasons.join(" ")).toMatch(/stock|insuffisant/i);
    });
  });

  describe("disponibilités maxAvailableKg", () => {
    it("ne dépasse jamais le stock de chaque intrant", () => {
      const caps: Record<string, number> = {
        corn: 80,
        soy: 25,
        bran: 40,
        fish: 10,
        oyster: 5,
        dcp: 5,
        lys: 2,
        met: 2,
        oil: 15,
        cmv: 10,
        salt: 10
      };
      const result = engine.formulate(
        baseInput("growing", {
          animalCount: 5,
          durationDays: 5,
          availableIngredients: FULL_PANEL.map((id) => ({
            feedIngredientId: id,
            pricePerKg: 300,
            maxAvailableKg: caps[id]
          }))
        })
      );
      expect(result.feasible).toBe(true);
      for (const line of result.ration) {
        expect(line.quantityKg).toBeLessThanOrEqual(
          (caps[line.feedIngredientId] ?? 0) + 1e-6
        );
      }
    });
  });

  describe("substitution", () => {
    it("recalcule et rapporte l'écart énergétique vs base", () => {
      const input = baseInput("growing");
      const sub = engine.recomputeWithSubstitution(input, "soy", {
        feedIngredientId: "fish",
        pricePerKg: 800,
        maxAvailableKg: 10_000,
        nutrition: NUTRI.fish
      });
      // Base avait déjà fish — on retire soy et on « ajoute » fish (déjà présent).
      // Cas plus clair : retirer bran, ajouter oil (hausse énergie attendue si feasible).
      const sub2 = engine.recomputeWithSubstitution(input, "bran", {
        feedIngredientId: "oil",
        pricePerKg: 900,
        maxAvailableKg: 10_000,
        nutrition: NUTRI.oil
      });
      expect(sub.baseFeasible).toBe(true);
      if (sub2.feasible && sub2.nutritionDelta) {
        expect(typeof sub2.nutritionDelta.energyChangePct).toBe("number");
        expect(sub2.nutritionDelta).toHaveProperty("crudeProteinPct");
        expect(sub2.nutritionDelta).toHaveProperty("metabolizableEnergyKcal");
      } else {
        // Si oil rend infaisable (plafond EM), on doit avoir un diagnostic clair.
        expect(sub2.feasible).toBe(false);
        expect(sub2.ration).toEqual([]);
        expect(sub2.infeasibilityReasons.length).toBeGreaterThan(0);
      }
      // Toujours : pas d'effet de bord sur l'input d'origine.
      expect(input.availableIngredients.some((a) => a.feedIngredientId === "bran")).toBe(
        true
      );
      expect(input.availableIngredients.some((a) => a.feedIngredientId === "soy")).toBe(
        true
      );
    });

    it("substitution soja→farine poisson : delta nutritionnel cohérent si feasible", () => {
      const input = baseInput("fattening", {
        availableIngredients: availableAll([
          "corn",
          "soy",
          "bran",
          "oyster",
          "dcp",
          "lys",
          "met",
          "cmv",
          "salt"
        ])
      });
      const base = engine.formulate(input);
      expect(base.feasible).toBe(true);
      const sub = engine.recomputeWithSubstitution(input, "soy", {
        feedIngredientId: "fish",
        pricePerKg: 800,
        maxAvailableKg: 10_000,
        nutrition: NUTRI.fish
      });
      expect(sub.baseFeasible).toBe(true);
      if (sub.feasible) {
        expect(sub.nutritionDelta).not.toBeNull();
        expect(sub.nutritionResult).not.toBeNull();
        const expectedCp =
          sub.nutritionResult!.crudeProteinPct - base.nutritionResult!.crudeProteinPct;
        expect(sub.nutritionDelta!.crudeProteinPct).toBeCloseTo(expectedCp, 3);
        const expectedMe =
          sub.nutritionResult!.metabolizableEnergyKcal -
          base.nutritionResult!.metabolizableEnergyKcal;
        expect(sub.nutritionDelta!.metabolizableEnergyKcal).toBeCloseTo(expectedMe, 2);
      }
    });
  });

  describe("déterminisme", () => {
    it("même entrée → même sortie (2 runs)", () => {
      const input = baseInput("finishing");
      const a = engine.formulate(input);
      const b = engine.formulate(input);
      expect(a).toEqual(b);
    });
  });

  describe("optimalité (cas simple connu)", () => {
    it("2 intrants : coût ≤ ration manuelle valide", () => {
      // Profil simplifié : CP ≥ 16, EM 3000–3400, lys ≥ 0.5, met ≥ 0.2, ca ≥ 0.5, p ≥ 0.4
      const simpleProfile: RequirementProfileSnapshot = {
        stage: "growing",
        minCrudeProteinPct: 16,
        maxCrudeProteinPct: 50,
        minMetabolizableEnergyKcal: 2800,
        maxMetabolizableEnergyKcal: 3400,
        minLysinePct: 0.5,
        minMethioninePct: 0.2,
        minCalciumPct: 0.5,
        maxCalciumPct: 2,
        minPhosphorusPct: 0.4,
        maxFiberPct: 12,
        minLysinePerMcal: null,
        targetDailyIntakeKg: 1,
        fixedInclusions: []
      };
      const input: FormulateInput = {
        stage: "growing",
        animalCount: 1,
        avgWeightKg: 40,
        durationDays: 1,
        profile: simpleProfile,
        nutritionById: NUTRI,
        availableIngredients: [
          { feedIngredientId: "corn", pricePerKg: 200, maxAvailableKg: 100 },
          { feedIngredientId: "soy", pricePerKg: 450, maxAvailableKg: 100 },
          { feedIngredientId: "oyster", pricePerKg: 100, maxAvailableKg: 100 },
          { feedIngredientId: "dcp", pricePerKg: 350, maxAvailableKg: 100 }
        ]
      };
      const opt = engine.formulate(input);
      expect(opt.feasible).toBe(true);

      // Ration manuelle valide : 60 % maïs + 35 % soja + 3 % oyster + 2 % dcp
      const manualProps = { corn: 0.6, soy: 0.35, oyster: 0.03, dcp: 0.02 };
      const manualCostPerKg =
        0.6 * 200 + 0.35 * 450 + 0.03 * 100 + 0.02 * 350;
      const manualCp =
        0.6 * 8.5 + 0.35 * 44 + 0.03 * 0 + 0.02 * 0;
      const manualMe =
        0.6 * 3300 + 0.35 * 3200 + 0.03 * 0 + 0.02 * 0;
      expect(manualCp).toBeGreaterThanOrEqual(16);
      expect(manualMe).toBeGreaterThanOrEqual(2800);
      expect(manualMe).toBeLessThanOrEqual(3400);

      expect(opt.costPerKg).toBeLessThanOrEqual(manualCostPerKg + 0.05);
      void manualProps;
    });
  });

  describe("quantité totale", () => {
    it("totalFeedKg = ingéré × effectif × durée", () => {
      const result = engine.formulate(
        baseInput("growing", {
          animalCount: 20,
          durationDays: 10,
          profile: { ...profileOf("growing"), targetDailyIntakeKg: 1.5 }
        })
      );
      expect(result.feasible).toBe(true);
      expect(result.dailyIntakeKg).toBe(1.5);
      expect(result.totalFeedKg).toBeCloseTo(1.5 * 20 * 10, 3);
    });
  });

  describe("taux fixes (prémélanges CMV / sel)", () => {
    it.each(
      FEED_REQUIREMENTS_SEED.filter((r) =>
        r.fixedInclusionsByName.some(
          (f) => f.canonicalName === "Complément minéral vitaminé (CMV)"
        )
      ).map((r) => [r.stage, r] as const)
    )(
      "stade %s : CMV présent au taux fixe prescrit",
      (stage, seed) => {
        const result = engine.formulate(baseInput(stage));
        expect(result.feasible).toBe(true);
        const cmvLine = result.ration.find((l) => l.feedIngredientId === "cmv");
        expect(cmvLine).toBeDefined();
        const expectedPct = seed.fixedInclusionsByName.find(
          (f) => f.canonicalName === "Complément minéral vitaminé (CMV)"
        )!.inclusionPct;
        expect(cmvLine!.proportionPct).toBeCloseTo(expectedPct, 3);
        const saltSeed = seed.fixedInclusionsByName.find(
          (f) => f.canonicalName === "Sel"
        );
        if (saltSeed) {
          const saltLine = result.ration.find((l) => l.feedIngredientId === "salt");
          expect(saltLine).toBeDefined();
          expect(saltLine!.proportionPct).toBeCloseTo(saltSeed.inclusionPct, 3);
        }
        const sumPct = result.ration.reduce((s, l) => s + l.proportionPct, 0);
        expect(sumPct).toBeGreaterThan(99.5);
        expect(sumPct).toBeLessThan(100.5);
      }
    );

    it("apports Ca/P du CMV comptés → moins de phosphate que si CMV sans minéraux", () => {
      // CMV riche à 3 % : contribution Ca/P significative au bilan.
      const profile = profileOf("growing", [
        { feedIngredientId: "cmv", inclusionPct: 3 },
        { feedIngredientId: "salt", inclusionPct: 0.3 }
      ]);
      const richCmv = {
        ...NUTRI,
        cmv: { ...NUTRI.cmv, calciumPct: 20, phosphorusPct: 12 }
      };
      const withCmvMinerals = engine.formulate(
        baseInput("growing", { profile, nutritionById: richCmv })
      );
      expect(withCmvMinerals.feasible).toBe(true);

      const zeroMineralsNutri = {
        ...richCmv,
        cmv: { ...richCmv.cmv, calciumPct: 0, phosphorusPct: 0 }
      };
      const withoutCmvMinerals = engine.formulate(
        baseInput("growing", { profile, nutritionById: zeroMineralsNutri })
      );
      expect(withoutCmvMinerals.feasible).toBe(true);

      const dcpWith =
        withCmvMinerals.ration.find((l) => l.feedIngredientId === "dcp")
          ?.proportionPct ?? 0;
      const dcpWithout =
        withoutCmvMinerals.ration.find((l) => l.feedIngredientId === "dcp")
          ?.proportionPct ?? 0;
      expect(dcpWith).toBeLessThan(dcpWithout - 0.05);

      // CMV reste au même taux fixe (non optimisé).
      expect(
        withCmvMinerals.ration.find((l) => l.feedIngredientId === "cmv")!
          .proportionPct
      ).toBeCloseTo(3, 3);
      expect(
        withoutCmvMinerals.ration.find((l) => l.feedIngredientId === "cmv")!
          .proportionPct
      ).toBeCloseTo(3, 3);
    });

    it("modifier un taux fixe admin change la ration", () => {
      const base = engine.formulate(baseInput("fattening"));
      expect(base.feasible).toBe(true);
      const cmvBase = base.ration.find((l) => l.feedIngredientId === "cmv")!;
      expect(cmvBase.proportionPct).toBeCloseTo(0.5, 3);

      const modified = engine.formulate(
        baseInput("fattening", {
          profile: profileOf("fattening", [
            { feedIngredientId: "cmv", inclusionPct: 2 },
            { feedIngredientId: "salt", inclusionPct: 0.3 }
          ])
        })
      );
      expect(modified.feasible).toBe(true);
      const cmvMod = modified.ration.find((l) => l.feedIngredientId === "cmv")!;
      expect(cmvMod.proportionPct).toBeCloseTo(2, 3);
      expect(cmvMod.proportionPct).not.toBeCloseTo(cmvBase.proportionPct, 2);

      const sumPct = modified.ration.reduce((s, l) => s + l.proportionPct, 0);
      expect(sumPct).toBeGreaterThan(99.5);
      expect(sumPct).toBeLessThan(100.5);
    });

    it("Σ taux fixes > 5 % → avertissement sans bloquer", () => {
      // Engraissement (EM min plus bas) : reste faisable malgré 6 % de dilution.
      const result = engine.formulate(
        baseInput("fattening", {
          profile: profileOf("fattening", [
            { feedIngredientId: "cmv", inclusionPct: 4 },
            { feedIngredientId: "salt", inclusionPct: 2 }
          ])
        })
      );
      expect(result.feasible).toBe(true);
      expect(result.warnings.join(" ")).toMatch(/taux fixes|5\s*%|saisie/i);
      const cmv = result.ration.find((l) => l.feedIngredientId === "cmv")!;
      const salt = result.ration.find((l) => l.feedIngredientId === "salt")!;
      expect(cmv.proportionPct).toBeCloseTo(4, 3);
      expect(salt.proportionPct).toBeCloseTo(2, 3);
    });

    it("prémélange non prescrit (isPremix) n'est pas optimisé", () => {
      const result = engine.formulate(
        baseInput("growing", {
          profile: profileOf("growing", [
            { feedIngredientId: "cmv", inclusionPct: 0.5 }
            // sel disponible mais non prescrit
          ])
        })
      );
      expect(result.feasible).toBe(true);
      expect(result.ration.some((l) => l.feedIngredientId === "salt")).toBe(
        false
      );
      expect(result.warnings.join(" ")).toMatch(/Sel|prémélange/i);
    });
  });
});
