import { ServiceUnavailableException } from "@nestjs/common";
import { ProductionStage } from "@prisma/client";
import type {
  AiGeminiService,
  GeminiChatWithToolsResult
} from "../../ai/ai-gemini.service";
import type { FarmAccessService } from "../../common/farm-access.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { FeedFormulationService } from "../feed-formulation.service";
import type { FormulateResult } from "../engine/feed-formulation.types";
import type { IngredientAvailabilityService } from "./ingredient-availability.service";
import {
  FeedCompositionAssistService,
  MAX_TOOL_ITERATIONS
} from "./feed-composition-assist.service";

const ENGINE_RESULT: FormulateResult = {
  feasible: true,
  ration: [
    {
      feedIngredientId: "corn",
      quantityKg: 70,
      proportionPct: 70,
      costContribution: 14000
    }
  ],
  totalFeedKg: 100,
  dailyIntakeKg: 1.5,
  totalCostXof: 20000,
  costPerKg: 200,
  nutritionResult: {
    crudeProteinPct: 16,
    metabolizableEnergyKcal: 3200,
    lysinePct: 0.95,
    methioninePct: 0.28,
    calciumPct: 0.7,
    phosphorusPct: 0.5,
    crudeFiberPct: 4,
    lysinePerMcal: 2.97
  },
  deviations: [],
  warnings: [],
  infeasibilityReasons: []
};

function geminiResult(
  partial: Partial<GeminiChatWithToolsResult> &
    Pick<GeminiChatWithToolsResult, "functionCalls" | "modelContent">
): GeminiChatWithToolsResult {
  return {
    text: partial.text ?? null,
    functionCalls: partial.functionCalls,
    modelContent: partial.modelContent,
    usage: partial.usage ?? { inputTokens: 100, outputTokens: 50 }
  };
}

describe("FeedCompositionAssistService (Gemini)", () => {
  const user = { id: "user-1" } as never;
  let gemini: jest.Mocked<
    Pick<
      AiGeminiService,
      | "isConfigured"
      | "isQuotaBlocked"
      | "chatWithTools"
      | "logToolUsage"
      | "primaryModel"
    >
  >;
  let formulation: jest.Mocked<
    Pick<FeedFormulationService, "formulate" | "recomputeWithSubstitution">
  >;
  let availability: jest.Mocked<Pick<IngredientAvailabilityService, "resolve">>;
  let farmAccess: jest.Mocked<Pick<FarmAccessService, "requireFarmAccess">>;
  let prisma: {
    farm: { findUnique: jest.Mock };
    animal: { count: jest.Mock };
    feedIngredient: { findUnique: jest.Mock };
  };
  let service: FeedCompositionAssistService;

  beforeEach(() => {
    gemini = {
      isConfigured: jest.fn().mockReturnValue(true),
      isQuotaBlocked: jest.fn().mockReturnValue(false),
      chatWithTools: jest.fn(),
      logToolUsage: jest.fn(),
      primaryModel: jest.fn().mockReturnValue("gemini-2.5-flash-lite")
    };
    formulation = {
      formulate: jest.fn().mockResolvedValue(ENGINE_RESULT),
      recomputeWithSubstitution: jest.fn().mockResolvedValue({
        ...ENGINE_RESULT,
        nutritionDelta: null,
        baseFeasible: true
      })
    };
    availability = {
      resolve: jest.fn().mockResolvedValue({
        availableIngredients: [
          { feedIngredientId: "corn", pricePerKg: 200, maxAvailableKg: 1000 }
        ],
        isTheoretical: true,
        millProfileId: null,
        warning: "théorique"
      })
    };
    farmAccess = {
      requireFarmAccess: jest.fn().mockResolvedValue({ id: "farm-1" })
    };
    prisma = {
      farm: {
        findUnique: jest.fn().mockResolvedValue({
          id: "farm-1",
          name: "Ferme Test",
          speciesFocus: "porcin"
        })
      },
      animal: { count: jest.fn().mockResolvedValue(42) },
      feedIngredient: { findUnique: jest.fn() }
    };

    service = new FeedCompositionAssistService(
      gemini as unknown as AiGeminiService,
      formulation as unknown as FeedFormulationService,
      availability as unknown as IngredientAvailabilityService,
      farmAccess as unknown as FarmAccessService,
      prisma as unknown as PrismaService
    );
  });

  it("mode dégradé appelle FeedFormulationService (même moteur)", async () => {
    const res = await service.formulateManual(user, {
      farmId: "farm-1",
      stage: ProductionStage.growing,
      animalCount: 10,
      avgWeightKg: 40,
      durationDays: 7
    });
    expect(formulation.formulate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: ProductionStage.growing,
        animalCount: 10,
        avgWeightKg: 40,
        durationDays: 7
      }),
      "user-1"
    );
    expect(res.formulation).toEqual(ENGINE_RESULT);
  });

  it("l'agent appelle l'outil Gemini et la ration vient du moteur", async () => {
    gemini.chatWithTools
      .mockResolvedValueOnce(
        geminiResult({
          functionCalls: [
            {
              name: "formulate_ration",
              args: {
                stage: "growing",
                animalCount: 10,
                avgWeightKg: 40,
                durationDays: 7
              }
            }
          ],
          modelContent: {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "formulate_ration",
                  args: {
                    stage: "growing",
                    animalCount: 10,
                    avgWeightKg: 40,
                    durationDays: 7
                  }
                }
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        geminiResult({
          text: "Voici ta ration calculée : 70 kg de maïs.",
          functionCalls: [],
          modelContent: {
            role: "model",
            parts: [{ text: "Voici ta ration calculée : 70 kg de maïs." }]
          }
        })
      );

    const res = await service.assist(user, {
      farmId: "farm-1",
      message: "Formule pour 10 porcs de 40 kg pendant 7 jours, stade croissance"
    });

    expect(formulation.formulate).toHaveBeenCalledTimes(1);
    expect(res.formulation).toBe(ENGINE_RESULT);
    expect(res.reply).toContain("ration");
    expect(res.toolIterations).toBe(1);
    expect(gemini.logToolUsage).toHaveBeenCalled();

    const secondCall = gemini.chatWithTools.mock.calls[1]![0];
    const toolResult = secondCall.contents.find(
      (c) =>
        c.role === "user" &&
        c.parts.some((p) => "functionResponse" in p)
    );
    expect(toolResult).toBeDefined();
    const fr = toolResult!.parts.find((p) => "functionResponse" in p) as unknown as {
      functionResponse: { response: { result: FormulateResult } };
    };
    expect(fr.functionResponse.response.result.ration).toEqual(
      ENGINE_RESULT.ration
    );
  });

  it("même entrée : mode manuel = outil IA (même résultat moteur)", async () => {
    gemini.chatWithTools
      .mockResolvedValueOnce(
        geminiResult({
          functionCalls: [
            {
              name: "formulate_ration",
              args: {
                stage: "finishing",
                animalCount: 5,
                avgWeightKg: 90,
                durationDays: 14
              }
            }
          ],
          modelContent: {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "formulate_ration",
                  args: {
                    stage: "finishing",
                    animalCount: 5,
                    avgWeightKg: 90,
                    durationDays: 14
                  }
                }
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        geminiResult({
          text: "OK",
          functionCalls: [],
          modelContent: { role: "model", parts: [{ text: "OK" }] }
        })
      );

    const dto = {
      farmId: "farm-1",
      stage: ProductionStage.finishing,
      animalCount: 5,
      avgWeightKg: 90,
      durationDays: 14
    };
    const manual = await service.formulateManual(user, dto);
    const ai = await service.assist(user, {
      farmId: "farm-1",
      message: "finition 5 porcs 90 kg 14 jours",
      stageHint: ProductionStage.finishing
    });

    expect(manual.formulation).toEqual(ai.formulation);
  });

  it("respecte la limite d'itérations tool-use", async () => {
    gemini.chatWithTools.mockImplementation(async () =>
      geminiResult({
        functionCalls: [
          {
            name: "formulate_ration",
            args: {
              stage: "growing",
              animalCount: 1,
              avgWeightKg: 30,
              durationDays: 1
            }
          }
        ],
        modelContent: {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "formulate_ration",
                args: {
                  stage: "growing",
                  animalCount: 1,
                  avgWeightKg: 30,
                  durationDays: 1
                }
              }
            }
          ]
        }
      })
    );

    const res = await service.assist(user, {
      farmId: "farm-1",
      message: "calcule encore"
    });

    expect(res.toolIterations).toBeLessThanOrEqual(MAX_TOOL_ITERATIONS);
    expect(res.degradedHint).toMatch(/MAX_TOOL_ITERATIONS/);
    expect(formulation.formulate.mock.calls.length).toBeLessThanOrEqual(
      MAX_TOOL_ITERATIONS
    );
  });

  it("Gemini absente → AI_UNAVAILABLE", async () => {
    gemini.isConfigured.mockReturnValue(false);
    await expect(
      service.assist(user, { farmId: "farm-1", message: "bonjour" })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("erreur Gemini → AI_UNAVAILABLE", async () => {
    gemini.chatWithTools.mockResolvedValue(null);
    try {
      await service.assist(user, { farmId: "farm-1", message: "bonjour" });
      fail("devrait lever");
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      expect((e as ServiceUnavailableException).getResponse()).toMatchObject({
        code: "AI_UNAVAILABLE"
      });
    }
  });
});
