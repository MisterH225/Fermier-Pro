import { isFeedCompositionModuleActive } from "../feedComposition";
import type { PlatformModuleDto } from "../api/config";
import {
  buildInfeasibilityMessage,
  isAiUnavailableError,
  nutrientLabelFr,
  respectsLeanPorkGoal,
  stageLabelFr
} from "../feedCompositionFormat";
import {
  buildLocalFactualExplanation,
  notableDeviationsOnly
} from "../compositionExplanation";
import type { FeedFormulateResultDto } from "../api/feed-composition";
import { ApiError } from "../api/http";

function mod(
  moduleId: PlatformModuleDto["moduleId"],
  isActive: boolean
): PlatformModuleDto {
  return {
    moduleId,
    moduleName: moduleId,
    icon: null,
    isActive,
    canDisable: true,
    userMessageFr: null,
    userMessageEn: null,
    scheduledReactivation: null
  };
}

const feasible: FeedFormulateResultDto = {
  feasible: true,
  ration: [
    {
      feedIngredientId: "corn",
      canonicalName: "Maïs",
      quantityKg: 70,
      proportionPct: 70,
      costContribution: 14000
    },
    {
      feedIngredientId: "soy",
      canonicalName: "Tourteau de soja",
      quantityKg: 25,
      proportionPct: 25,
      costContribution: 11000
    }
  ],
  totalFeedKg: 100,
  dailyIntakeKg: 1.5,
  totalCostXof: 20000,
  costPerKg: 200,
  nutritionResult: {
    crudeProteinPct: 15.2,
    metabolizableEnergyKcal: 3100,
    lysinePct: 0.8,
    methioninePct: 0.25,
    calciumPct: 0.7,
    phosphorusPct: 0.5,
    crudeFiberPct: 4,
    lysinePerMcal: 2.6
  },
  deviations: [
    {
      nutrient: "crudeProteinPct",
      target: "≥ 14",
      actual: 15.2,
      withinBounds: true
    },
    {
      nutrient: "crudeProteinPct",
      target: "≤ 17",
      actual: 15.2,
      withinBounds: true
    },
    {
      nutrient: "metabolizableEnergyKcal",
      target: "≤ 3200",
      actual: 3100,
      withinBounds: true
    }
  ],
  warnings: [],
  infeasibilityReasons: []
};

describe("isFeedCompositionModuleActive", () => {
  it("flag OFF → false", () => {
    expect(
      isFeedCompositionModuleActive([
        mod("mills", true),
        mod("feed_composition", false)
      ])
    ).toBe(false);
  });

  it("flag ON → true", () => {
    expect(
      isFeedCompositionModuleActive([mod("feed_composition", true)])
    ).toBe(true);
  });

  it("modules absents → false", () => {
    expect(isFeedCompositionModuleActive(undefined)).toBe(false);
  });
});

describe("feedCompositionFormat", () => {
  it("labels stade FR métier (mapping unique)", () => {
    expect(stageLabelFr("fattening")).toBe("Engraissement");
    expect(stageLabelFr("piglet_weaning")).toBe("Sevrage");
    expect(stageLabelFr("growing")).toBe("Croissance");
    expect(stageLabelFr("finishing")).toBe("Finition");
    expect(stageLabelFr("gestating_sow")).toBe("Truie gestante");
    expect(stageLabelFr("lactating_sow")).toBe("Truie allaitante");
  });

  it("nutriments en langage producteur (sans gabarit bon niveau)", () => {
    expect(nutrientLabelFr("crudeProteinPct")).toMatch(/Protéines/i);
    expect(nutrientLabelFr("metabolizableEnergyKcal")).toMatch(/Énergie/i);
  });

  it("message infaisable clair", () => {
    const msg = buildInfeasibilityMessage(["protéine trop basse"]);
    expect(msg).toMatch(/n’y arrive pas|On n’y arrive pas/i);
    expect(msg).toMatch(/aliment du commerce/i);
  });

  it("affiche tel quel un diagnostic actionnable (énergie / huile)", () => {
    const api =
      "L'énergie nécessaire pour ce stade ne peut pas être atteinte avec vos intrants — ajoutez une source de matière grasse (huile), ou utilisez un aliment du commerce adapté.";
    const msg = buildInfeasibilityMessage([api]);
    expect(msg).toMatch(/énergie/i);
    expect(msg).toMatch(/matière grasse|huile/i);
    expect(msg).not.toMatch(/combinaison de contraintes/i);
  });

  it("remplace le message générique combinaison incompatible", () => {
    const msg = buildInfeasibilityMessage([
      "Combinaison de contraintes incompatible avec les intrants, stocks et taux fixes disponibles."
    ]);
    expect(msg).toMatch(/huile|tourteau|aliment du commerce/i);
    expect(msg).not.toMatch(/combinaison de contraintes incompatible/i);
  });

  it("porc sans graisse respecté en finition", () => {
    expect(respectsLeanPorkGoal(feasible, "finishing")).toBe(true);
    expect(respectsLeanPorkGoal(feasible, "growing")).toBe(false);
  });

  it("détecte AI_UNAVAILABLE", () => {
    expect(isAiUnavailableError(new ApiError("down", 503, "AI_UNAVAILABLE"))).toBe(
      true
    );
    expect(isAiUnavailableError(new Error("autre"))).toBe(false);
  });
});

describe("compositionExplanation (fallback + déduplication)", () => {
  it("fallback factuel référence stade et intrants, sans gabarit mort", () => {
    const expl = buildLocalFactualExplanation({
      stage: "fattening",
      animalCount: 30,
      avgWeightKg: 45,
      formulation: feasible
    });
    expect(expl).not.toBeNull();
    expect(expl!.stageNeeds).toMatch(/Engraissement|engraissement/i);
    expect(expl!.stageNeeds).toMatch(/3100/);
    expect(expl!.energyKcalPerKg).toBe(3100);
    expect(expl!.ingredientJustifications.some((j) => /Maïs/i.test(j.name))).toBe(
      true
    );
    expect(JSON.stringify(expl)).not.toMatch(/bon niveau|fait grossir/i);
  });

  it("ne duplique pas les lignes d’écarts min+max dans les bornes", () => {
    expect(notableDeviationsOnly(feasible.deviations)).toEqual([]);
  });

  it("signale un écart hors bornes une seule fois", () => {
    const lines = notableDeviationsOnly([
      {
        nutrient: "metabolizableEnergyKcal",
        target: "≤ 3200",
        actual: 3400,
        withinBounds: false
      },
      {
        nutrient: "metabolizableEnergyKcal",
        target: "≥ 3000",
        actual: 3400,
        withinBounds: true
      }
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/Énergie/i);
  });
});
