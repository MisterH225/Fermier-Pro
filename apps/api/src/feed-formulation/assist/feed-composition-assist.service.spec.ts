import { ServiceUnavailableException } from "@nestjs/common";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { ProductionStage } from "@prisma/client";
import {
  FeedCompositionAssistService,
  MAX_TOOL_ITERATIONS
} from "./feed-composition-assist.service";
import type { AnthropicClientService } from "./anthropic-client.service";
import type { FeedFormulationService } from "../feed-formulation.service";
import type { IngredientAvailabilityService } from "./ingredient-availability.service";
import type { FarmAccessService } from "../../common/farm-access.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { FormulateResult } from "../engine/feed-formulation.types";

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

function mockMessage(partial: {
  stop_reason?: Message["stop_reason"];
  content: unknown[];
}): Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    stop_reason: partial.stop_reason ?? "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
    content: partial.content
  } as unknown as Message;
}

describe("FeedCompositionAssistService", () => {
  const user = { id: "user-1" } as never;
  let anthropic: jest.Mocked<Pick<AnthropicClientService, "isConfigured" | "createMessage" | "logUsage" | "model">>;
  let formulation: jest.Mocked<Pick<FeedFormulationService, "formulate" | "recomputeWithSubstitution">>;
  let availability: jest.Mocked<Pick<IngredientAvailabilityService, "resolve">>;
  let farmAccess: jest.Mocked<Pick<FarmAccessService, "requireFarmAccess">>;
  let prisma: {
    farm: { findUnique: jest.Mock };
    animal: { count: jest.Mock };
    feedIngredient: { findUnique: jest.Mock };
  };
  let service: FeedCompositionAssistService;

  beforeEach(() => {
    anthropic = {
      isConfigured: jest.fn().mockReturnValue(true),
      createMessage: jest.fn(),
      logUsage: jest.fn(),
      model: jest.fn().mockReturnValue("claude-haiku-4-5-20251001")
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
      anthropic as unknown as AnthropicClientService,
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
        durationDays: 7,
        availableIngredients: expect.any(Array)
      }),
      "user-1"
    );
    expect(res.formulation).toEqual(ENGINE_RESULT);
    expect(res.isTheoretical).toBe(true);
  });

  it("l'agent appelle l'outil et la ration vient du moteur (pas de l'IA)", async () => {
    anthropic.createMessage
      .mockResolvedValueOnce(
        mockMessage({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tu_1",
              name: "formulate_ration",
              input: {
                stage: "growing",
                animalCount: 10,
                avgWeightKg: 40,
                durationDays: 7
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        mockMessage({
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: "Voici ta ration calculée : 70 kg de maïs."
            }
          ]
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
    expect(anthropic.logUsage).toHaveBeenCalled();
    // L'IA n'injecte pas sa propre ration : payload tool_result = moteur
    const secondCall = anthropic.createMessage.mock.calls[1]![0];
    const toolResultMsg = secondCall.messages.find(
      (m) => m.role === "user" && Array.isArray(m.content)
    );
    expect(toolResultMsg).toBeDefined();
    const blocks = toolResultMsg!.content as Array<{
      type: string;
      content: string;
    }>;
    const parsed = JSON.parse(blocks[0]!.content) as FormulateResult;
    expect(parsed.ration).toEqual(ENGINE_RESULT.ration);
    expect(parsed.totalCostXof).toBe(ENGINE_RESULT.totalCostXof);
  });

  it("même entrée : mode manuel = outil IA (même résultat moteur)", async () => {
    anthropic.createMessage
      .mockResolvedValueOnce(
        mockMessage({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tu_1",
              name: "formulate_ration",
              input: {
                stage: "finishing",
                animalCount: 5,
                avgWeightKg: 90,
                durationDays: 14
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        mockMessage({
          content: [{ type: "text", text: "OK" }]
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
    expect(formulation.formulate.mock.calls[0]![0]).toMatchObject({
      stage: ProductionStage.finishing,
      animalCount: 5,
      avgWeightKg: 90,
      durationDays: 14
    });
    expect(formulation.formulate.mock.calls[1]![0]).toMatchObject({
      stage: ProductionStage.finishing,
      animalCount: 5,
      avgWeightKg: 90,
      durationDays: 14
    });
  });

  it("respecte la limite d'itérations tool-use", async () => {
    anthropic.createMessage.mockImplementation(async () =>
      mockMessage({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: `tu_${Math.random()}`,
            name: "formulate_ration",
            input: {
              stage: "growing",
              animalCount: 1,
              avgWeightKg: 30,
              durationDays: 1
            }
          }
        ]
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

  it("AI absente → AI_UNAVAILABLE (bascule mobile vers formulate)", async () => {
    anthropic.isConfigured.mockReturnValue(false);
    await expect(
      service.assist(user, { farmId: "farm-1", message: "bonjour" })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("erreur Anthropic → AI_UNAVAILABLE", async () => {
    anthropic.createMessage.mockRejectedValue(new Error("network"));
    try {
      await service.assist(user, { farmId: "farm-1", message: "bonjour" });
      fail("devrait lever");
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      const body = (e as ServiceUnavailableException).getResponse();
      expect(body).toMatchObject({ code: "AI_UNAVAILABLE" });
    }
  });
});
