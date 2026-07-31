import type { AiGeminiService } from "../../../ai/ai-gemini.service";
import type { FarmAccessService } from "../../../common/farm-access.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { FeedRequirementProfilesService } from "../../feed-requirement-profiles.service";
import type { RequirementProfileSnapshot } from "../../engine/feed-formulation.types";
import { assertNoHallucinatedNumbers } from "./build-explain-prompt";
import {
  buildFactualExplanation,
  dedupeNotableDeviations
} from "./build-factual-explanation";
import { FeedCompositionExplainService } from "./feed-composition-explain.service";
import { computeRationFingerprint } from "./ration-fingerprint";
import { buildIngredientRoles } from "./ingredient-roles";

const PROFILE: RequirementProfileSnapshot = {
  stage: "fattening",
  minCrudeProteinPct: 14,
  maxCrudeProteinPct: 17,
  minMetabolizableEnergyKcal: 3000,
  maxMetabolizableEnergyKcal: 3200,
  minLysinePct: 0.75,
  minMethioninePct: 0.24,
  minCalciumPct: 0.55,
  maxCalciumPct: 0.9,
  minPhosphorusPct: 0.45,
  maxFiberPct: 6,
  minLysinePerMcal: 2.6,
  targetDailyIntakeKg: 2.4,
  fixedInclusions: []
};

const NUTRITION = {
  crudeProteinPct: 15.2,
  metabolizableEnergyKcal: 3100,
  lysinePct: 0.82,
  methioninePct: 0.26,
  calciumPct: 0.7,
  phosphorusPct: 0.5,
  crudeFiberPct: 4.2,
  lysinePerMcal: 2.65
};

const RATION = [
  {
    feedIngredientId: "corn",
    canonicalName: "Maïs jaune",
    quantityKg: 70,
    proportionPct: 70
  },
  {
    feedIngredientId: "soy",
    canonicalName: "Tourteau de soja",
    quantityKg: 25,
    proportionPct: 25
  },
  {
    feedIngredientId: "cmv",
    canonicalName: "Complément minéral vitaminé (CMV)",
    quantityKg: 0.5,
    proportionPct: 0.5
  },
  {
    feedIngredientId: "salt",
    canonicalName: "Sel",
    quantityKg: 0.3,
    proportionPct: 0.3
  }
];

describe("buildFactualExplanation", () => {
  it("référence le stade et les intrants réels (pas de gabarit générique)", () => {
    const roles = buildIngredientRoles(
      RATION,
      new Map([
        [
          "corn",
          {
            canonicalName: "Maïs jaune",
            category: "cereal",
            crudeProteinPct: 8.5,
            metabolizableEnergyKcal: 3300,
            lysinePct: 0.25,
            calciumPct: 0.02,
            phosphorusPct: 0.27
          }
        ],
        [
          "soy",
          {
            canonicalName: "Tourteau de soja",
            category: "plant_protein",
            crudeProteinPct: 44,
            metabolizableEnergyKcal: 3200,
            lysinePct: 2.7,
            calciumPct: 0.3,
            phosphorusPct: 0.65
          }
        ],
        [
          "cmv",
          {
            canonicalName: "Complément minéral vitaminé (CMV)",
            category: "additive",
            crudeProteinPct: 0,
            metabolizableEnergyKcal: 0,
            lysinePct: 0,
            calciumPct: 15,
            phosphorusPct: 5
          }
        ],
        [
          "salt",
          {
            canonicalName: "Sel",
            category: "mineral",
            crudeProteinPct: 0,
            metabolizableEnergyKcal: 0,
            lysinePct: 0,
            calciumPct: 0,
            phosphorusPct: 0
          }
        ]
      ])
    );

    const expl = buildFactualExplanation({
      stage: "fattening",
      animalCount: 30,
      avgWeightKg: 45,
      profile: PROFILE,
      nutrition: NUTRITION,
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
        }
      ],
      roles,
      rationFingerprint: "fp-test"
    });

    expect(expl.source).toBe("factual_fallback");
    expect(expl.stageNeeds).toMatch(/engraissement/i);
    expect(expl.stageNeeds).toMatch(/45/);
    expect(expl.stageNeeds).toMatch(/14/);
    expect(expl.stageNeeds).toMatch(/15,2|15.2/);
    expect(expl.energyKcalPerKg).toBe(3100);
    expect(expl.energyComment).toMatch(/3100/);
    expect(expl.energyComment).toMatch(/3200|anti-gras/i);

    const names = expl.ingredientJustifications.map((j) => j.name).join(" ");
    expect(names).toMatch(/Maïs/i);
    expect(names).toMatch(/soja/i);
    expect(names).toMatch(/CMV/i);
    expect(expl.ingredientJustifications.some((j) =>
      j.text.toLowerCase().includes("énergie")
    )).toBe(true);
    // Pas d'ancien gabarit « bon niveau / fait grossir »
    expect(JSON.stringify(expl)).not.toMatch(/bon niveau|fait grossir/i);
    // Dans les bornes → pas d'écarts notables (déduplication)
    expect(expl.notableDeviations).toEqual([]);
  });
});

describe("dedupeNotableDeviations", () => {
  it("n'affiche pas deux fois le même nutriment OK (bug duplication)", () => {
    expect(
      dedupeNotableDeviations([
        {
          nutrient: "crudeProteinPct",
          target: "≥ 14",
          actual: 15,
          withinBounds: true
        },
        {
          nutrient: "crudeProteinPct",
          target: "≤ 17",
          actual: 15,
          withinBounds: true
        }
      ])
    ).toEqual([]);
  });

  it("regroupe les écarts hors bornes par nutriment", () => {
    const lines = dedupeNotableDeviations([
      {
        nutrient: "metabolizableEnergyKcal",
        target: "≤ 3200",
        actual: 3300,
        withinBounds: false
      },
      {
        nutrient: "metabolizableEnergyKcal",
        target: "≥ 3000",
        actual: 3300,
        withinBounds: true
      }
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/Énergie/i);
    expect(lines[0]).toMatch(/3300/);
  });
});

describe("assertNoHallucinatedNumbers", () => {
  it("accepte les nombres fournis", () => {
    expect(
      assertNoHallucinatedNumbers(
        ["protéines 15,2 % et 3100 kcal/kg pour 30 porcs"],
        [15.2, 3100, 30, 14, 17]
      )
    ).toBe(true);
  });

  it("rejette un chiffre inventé", () => {
    expect(
      assertNoHallucinatedNumbers(
        ["il faut 18,7 % de protéines"],
        [15.2, 3100, 14, 17]
      )
    ).toBe(false);
  });
});

describe("FeedCompositionExplainService — cache + IA", () => {
  const user = { id: "u1" } as never;

  function makeService(opts: {
    geminiText?: string | null;
    cachedExplanation?: unknown;
  }) {
    const gemini: jest.Mocked<
      Pick<
        AiGeminiService,
        | "isConfigured"
        | "isQuotaBlocked"
        | "generateJson"
        | "logGenerateUsage"
      >
    > = {
      isConfigured: jest.fn().mockReturnValue(true),
      isQuotaBlocked: jest.fn().mockReturnValue(false),
      generateJson: jest.fn().mockResolvedValue(
        opts.geminiText
          ? {
              text: opts.geminiText,
              usage: { inputTokens: 200, outputTokens: 100 }
            }
          : null
      ),
      logGenerateUsage: jest.fn()
    };
    const profiles: jest.Mocked<
      Pick<FeedRequirementProfilesService, "getActiveByStage">
    > = {
      getActiveByStage: jest.fn().mockResolvedValue(PROFILE)
    };
    const farmAccess: jest.Mocked<
      Pick<FarmAccessService, "requireFarmAccess">
    > = {
      requireFarmAccess: jest.fn().mockResolvedValue(undefined)
    };
    const prisma = {
      feedIngredient: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "corn",
            canonicalName: "Maïs jaune",
            category: "cereal",
            crudeProteinPct: 8.5,
            metabolizableEnergyKcal: 3300,
            lysinePct: 0.25,
            calciumPct: 0.02,
            phosphorusPct: 0.27
          },
          {
            id: "soy",
            canonicalName: "Tourteau de soja",
            category: "plant_protein",
            crudeProteinPct: 44,
            metabolizableEnergyKcal: 3200,
            lysinePct: 2.7,
            calciumPct: 0.3,
            phosphorusPct: 0.65
          },
          {
            id: "cmv",
            canonicalName: "Complément minéral vitaminé (CMV)",
            category: "additive",
            crudeProteinPct: 0,
            metabolizableEnergyKcal: 0,
            lysinePct: 0,
            calciumPct: 15,
            phosphorusPct: 5
          },
          {
            id: "salt",
            canonicalName: "Sel",
            category: "mineral",
            crudeProteinPct: 0,
            metabolizableEnergyKcal: 0,
            lysinePct: 0,
            calciumPct: 0,
            phosphorusPct: 0
          }
        ])
      },
      savedComposition: {
        findUnique: jest.fn().mockResolvedValue(
          opts.cachedExplanation !== undefined
            ? {
                id: "comp-1",
                farmId: "farm-1",
                explanation: opts.cachedExplanation
              }
            : null
        ),
        update: jest.fn().mockResolvedValue({})
      }
    };

    const service = new FeedCompositionExplainService(
      gemini as unknown as AiGeminiService,
      profiles as unknown as FeedRequirementProfilesService,
      farmAccess as unknown as FarmAccessService,
      prisma as unknown as PrismaService
    );
    return { service, gemini, prisma, farmAccess };
  }

  const dtoBase = {
    farmId: "farm-1",
    stage: "fattening" as const,
    animalCount: 30,
    avgWeightKg: 45,
    ration: RATION,
    nutritionResult: NUTRITION,
    deviations: [
      {
        nutrient: "crudeProteinPct",
        target: "≥ 14",
        actual: 15.2,
        withinBounds: true
      }
    ]
  };

  it("mode dégradé factuel si Gemini indisponible", async () => {
    const { service, gemini } = makeService({ geminiText: null });
    gemini.isConfigured.mockReturnValue(false);
    const res = await service.explain(user, dtoBase);
    expect(res.explanation.source).toBe("factual_fallback");
    expect(res.explanation.stageNeeds).toMatch(/engraissement/i);
    expect(res.explanation.ingredientJustifications.length).toBeGreaterThan(0);
    expect(res.cached).toBe(false);
  });

  it("utilise l'IA quand la réponse est valide (stade + intrants)", async () => {
    const aiJson = JSON.stringify({
      stageNeeds:
        "Des porcs en engraissement de 45 kg ont besoin d'environ 14 % à 17 % de protéines et 3000 à 3200 kcal/kg.",
      ingredientJustifications: [
        {
          feedIngredientId: "corn",
          name: "Maïs jaune",
          text: "Le maïs à 70 % fournit l'énergie (3100 kcal/kg au total)."
        },
        {
          feedIngredientId: "soy",
          name: "Tourteau de soja",
          text: "Le tourteau de soja à 25 % apporte les protéines."
        },
        {
          feedIngredientId: "cmv",
          name: "Complément minéral vitaminé (CMV)",
          text: "Le CMV à 0,5 % couvre vitamines et minéraux."
        }
      ],
      energyComment:
        "Valeur énergétique totale : 3100 kcal/kg, sous le plafond 3200 kcal/kg.",
      notableDeviations: []
    });
    const { service, gemini } = makeService({ geminiText: aiJson });
    const res = await service.explain(user, dtoBase);
    expect(res.explanation.source).toBe("ai");
    expect(res.explanation.stageNeeds).toMatch(/engraissement/i);
    expect(res.explanation.energyKcalPerKg).toBe(3100);
    expect(
      res.explanation.ingredientJustifications.some((j) =>
        j.name.toLowerCase().includes("maïs")
      )
    ).toBe(true);
    expect(gemini.logGenerateUsage).toHaveBeenCalled();
  });

  it("rejette l'IA si chiffres inventés → fallback factuel", async () => {
    const aiJson = JSON.stringify({
      stageNeeds: "Il faut 22,8 % de protéines magiques.",
      ingredientJustifications: [
        {
          feedIngredientId: "corn",
          name: "Maïs",
          text: "Le maïs apporte 99 % de tout."
        }
      ],
      energyComment: "Énergie 9999 kcal/kg.",
      notableDeviations: []
    });
    const { service } = makeService({ geminiText: aiJson });
    const res = await service.explain(user, dtoBase);
    expect(res.explanation.source).toBe("factual_fallback");
    expect(res.explanation.energyKcalPerKg).toBe(3100);
  });

  it("réutilise le cache si empreinte ration identique", async () => {
    const fp = computeRationFingerprint("fattening", RATION, NUTRITION);
    const cached = {
      stageNeeds: "Cache stade engraissement",
      ingredientJustifications: [
        {
          feedIngredientId: "corn",
          name: "Maïs jaune",
          text: "Cache maïs"
        }
      ],
      energyKcalPerKg: 3100,
      energyComment: "3100 kcal/kg",
      notableDeviations: [],
      source: "ai",
      rationFingerprint: fp
    };
    const { service, gemini } = makeService({
      geminiText: null,
      cachedExplanation: cached
    });
    const res = await service.explain(user, {
      ...dtoBase,
      savedCompositionId: "comp-1"
    });
    expect(res.cached).toBe(true);
    expect(res.explanation.stageNeeds).toMatch(/Cache stade/i);
    expect(gemini.generateJson).not.toHaveBeenCalled();
  });

  it("régénère si la ration a changé (empreinte différente)", async () => {
    const { service, gemini, prisma } = makeService({
      geminiText: null,
      cachedExplanation: {
        stageNeeds: "Ancien cache",
        rationFingerprint: "old-fp",
        energyKcalPerKg: 3100,
        energyComment: "x",
        ingredientJustifications: [],
        notableDeviations: [],
        source: "ai"
      }
    });
    const res = await service.explain(user, {
      ...dtoBase,
      savedCompositionId: "comp-1"
    });
    expect(res.cached).toBe(false);
    expect(res.explanation.source).toBe("factual_fallback");
    expect(prisma.savedComposition.update).toHaveBeenCalled();
    expect(gemini.isConfigured).toHaveBeenCalled();
  });
});
