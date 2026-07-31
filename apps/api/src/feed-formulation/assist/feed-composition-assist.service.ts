import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { ProductionStage, type User } from "@prisma/client";
import {
  AiGeminiService,
  type GeminiContent,
  type GeminiFunctionCall
} from "../../ai/ai-gemini.service";
import { FarmAccessService } from "../../common/farm-access.service";
import { PrismaService } from "../../prisma/prisma.service";
import { FeedFormulationService } from "../feed-formulation.service";
import type { FormulateRequest } from "../feed-formulation.service";
import type {
  AvailableIngredientInput,
  FormulateResult,
  SubstitutionResult
} from "../engine/feed-formulation.types";
import type {
  AssistFeedCompositionDto,
  FormulateFeedCompositionDto
} from "./dto/feed-composition.dto";
import { IngredientAvailabilityService } from "./ingredient-availability.service";
import { buildFeedCompositionSystemPrompt } from "./prompts/feed-composition-agent.system.fr";
import {
  FORMULATION_TOOLS,
  isFormulationToolName
} from "./tools/formulation-tools";
import {
  REFERENCE_PRICE_PER_KG,
  THEORETICAL_MAX_AVAILABLE_KG
} from "./reference-prices";

/** Borne les itérations tool-use (coût + anti-boucle). */
export const MAX_TOOL_ITERATIONS = 3;

export type AssistResponse = {
  reply: string;
  formulation: FormulateResult | SubstitutionResult | null;
  isTheoretical: boolean;
  millProfileId: string | null;
  toolIterations: number;
  usage: { inputTokens: number; outputTokens: number };
  degradedHint: string | null;
};

export type ManualFormulateResponse = {
  formulation: FormulateResult;
  isTheoretical: boolean;
  millProfileId: string | null;
  warning?: string;
};

/**
 * Orchestration agent Gemini + moteur FeedFormulationService.
 * L'IA n'est jamais source de calcul (function calling uniquement).
 */
@Injectable()
export class FeedCompositionAssistService {
  private readonly logger = new Logger(FeedCompositionAssistService.name);

  constructor(
    private readonly gemini: AiGeminiService,
    private readonly formulation: FeedFormulationService,
    private readonly availability: IngredientAvailabilityService,
    private readonly farmAccess: FarmAccessService,
    private readonly prisma: PrismaService
  ) {}

  /** Mode dégradé — même moteur, sans IA. */
  async formulateManual(
    user: User,
    dto: FormulateFeedCompositionDto
  ): Promise<ManualFormulateResponse> {
    await this.farmAccess.requireFarmAccess(user.id, dto.farmId);
    const avail = await this.availability.resolve(dto.millId);
    const request: FormulateRequest = {
      stage: dto.stage,
      animalCount: dto.animalCount,
      avgWeightKg: dto.avgWeightKg,
      avgAgeWeeks: dto.avgAgeWeeks,
      durationDays: dto.durationDays,
      availableIngredients: avail.availableIngredients
    };
    const formulation = await this.formulation.formulate(request, user.id);
    return {
      formulation,
      isTheoretical: avail.isTheoretical,
      millProfileId: avail.millProfileId,
      warning: avail.warning
    };
  }

  async assist(
    user: User,
    dto: AssistFeedCompositionDto
  ): Promise<AssistResponse> {
    await this.farmAccess.requireFarmAccess(user.id, dto.farmId);

    if (!this.gemini.isConfigured() || this.gemini.isQuotaBlocked()) {
      throw new ServiceUnavailableException({
        code: "AI_UNAVAILABLE",
        message:
          "Assistant IA indisponible (Gemini). Utilisez POST /feed-composition/formulate."
      });
    }

    const farmContext = await this.buildFarmContext(dto);
    const system = buildFeedCompositionSystemPrompt(farmContext);

    const contents: GeminiContent[] = [
      ...(dto.history ?? []).map((h) => ({
        role: (h.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: h.content }]
      })),
      { role: "user", parts: [{ text: dto.message }] }
    ];

    let toolIterations = 0;
    let lastFormulation: FormulateResult | SubstitutionResult | null = null;
    let isTheoretical = true;
    let millProfileId: string | null = dto.millId ?? null;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for (let i = 0; i <= MAX_TOOL_ITERATIONS; i++) {
        const response = await this.gemini.chatWithTools({
          system,
          contents,
          tools: FORMULATION_TOOLS
        });

        if (!response) {
          throw new Error("Gemini a renvoyé une réponse vide");
        }

        inputTokens += response.usage.inputTokens;
        outputTokens += response.usage.outputTokens;

        const toolUses = response.functionCalls;

        if (toolUses.length === 0) {
          this.gemini.logToolUsage(
            { inputTokens, outputTokens },
            { toolIterations }
          );
          return {
            reply:
              response.text ||
              "Je n'ai pas pu formuler de réponse. Réessaie avec le stade, l'effectif et le poids.",
            formulation: lastFormulation,
            isTheoretical,
            millProfileId,
            toolIterations,
            usage: { inputTokens, outputTokens },
            degradedHint: null
          };
        }

        if (toolIterations >= MAX_TOOL_ITERATIONS) {
          this.logger.warn(
            JSON.stringify({
              event: "gemini_tool_iteration_cap",
              toolIterations,
              inputTokens,
              outputTokens
            })
          );
          this.gemini.logToolUsage(
            { inputTokens, outputTokens },
            { toolIterations }
          );
          return {
            reply:
              response.text ||
              "Limite d'étapes atteinte. Utilise le formulaire manuel si besoin (mode sans IA).",
            formulation: lastFormulation,
            isTheoretical,
            millProfileId,
            toolIterations,
            usage: { inputTokens, outputTokens },
            degradedHint:
              "MAX_TOOL_ITERATIONS — bascule possible sur POST /feed-composition/formulate"
          };
        }

        contents.push(response.modelContent);

        const functionResponseParts: GeminiContent["parts"] = [];
        for (const tu of toolUses) {
          toolIterations += 1;
          const executed = await this.executeTool(user.id, tu, dto.millId);
          if (executed.formulation) {
            lastFormulation = executed.formulation;
          }
          isTheoretical = executed.isTheoretical;
          millProfileId = executed.millProfileId;
          functionResponseParts.push({
            functionResponse: {
              name: tu.name,
              response: { result: executed.payload } as Record<string, unknown>
            }
          });
        }

        contents.push({ role: "user", parts: functionResponseParts });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({
          event: "gemini_error",
          error: msg.slice(0, 200),
          toolIterations
        })
      );
      throw new ServiceUnavailableException({
        code: "AI_UNAVAILABLE",
        message:
          "Assistant IA indisponible. Utilisez POST /feed-composition/formulate (mode sans IA)."
      });
    }

    this.gemini.logToolUsage(
      { inputTokens, outputTokens },
      { toolIterations }
    );
    return {
      reply:
        "Limite d'étapes atteinte. Utilise le formulaire manuel (mode sans IA).",
      formulation: lastFormulation,
      isTheoretical,
      millProfileId,
      toolIterations,
      usage: { inputTokens, outputTokens },
      degradedHint: "MAX_TOOL_ITERATIONS"
    };
  }

  private async executeTool(
    userId: string,
    toolUse: GeminiFunctionCall,
    defaultMillId?: string
  ): Promise<{
    payload: unknown;
    formulation: FormulateResult | SubstitutionResult | null;
    isTheoretical: boolean;
    millProfileId: string | null;
  }> {
    if (!isFormulationToolName(toolUse.name)) {
      return {
        payload: { error: `Outil inconnu : ${toolUse.name}` },
        formulation: null,
        isTheoretical: true,
        millProfileId: null
      };
    }

    const input = toolUse.args ?? {};
    const stage = parseStage(input.stage);
    if (!stage) {
      return {
        payload: { error: "stage invalide" },
        formulation: null,
        isTheoretical: true,
        millProfileId: null
      };
    }

    const animalCount = Number(input.animalCount);
    const avgWeightKg = Number(input.avgWeightKg);
    const durationDays = Number(input.durationDays);
    const avgAgeWeeks =
      input.avgAgeWeeks != null ? Number(input.avgAgeWeeks) : undefined;
    const millId =
      typeof input.millId === "string" && input.millId.trim()
        ? input.millId.trim()
        : defaultMillId;

    if (!(animalCount > 0) || !(avgWeightKg > 0) || !(durationDays > 0)) {
      return {
        payload: {
          error: "animalCount, avgWeightKg et durationDays doivent être > 0"
        },
        formulation: null,
        isTheoretical: true,
        millProfileId: null
      };
    }

    const avail = await this.availability.resolve(millId);
    const baseRequest: FormulateRequest = {
      stage,
      animalCount,
      avgWeightKg,
      avgAgeWeeks:
        avgAgeWeeks != null && Number.isFinite(avgAgeWeeks)
          ? avgAgeWeeks
          : undefined,
      durationDays,
      availableIngredients: avail.availableIngredients
    };

    if (toolUse.name === "formulate_ration") {
      const formulation = await this.formulation.formulate(
        baseRequest,
        userId
      );
      return {
        payload: {
          ...formulation,
          isTheoretical: avail.isTheoretical,
          warning: avail.warning
        },
        formulation,
        isTheoretical: avail.isTheoretical,
        millProfileId: avail.millProfileId
      };
    }

    const removeIngredientId = String(input.removeIngredientId ?? "");
    const addIngredientId = String(input.addIngredientId ?? "");
    if (!removeIngredientId || !addIngredientId) {
      return {
        payload: { error: "removeIngredientId et addIngredientId requis" },
        formulation: null,
        isTheoretical: avail.isTheoretical,
        millProfileId: avail.millProfileId
      };
    }

    const addIngredient = await this.resolveSubstitute(
      addIngredientId,
      input,
      avail.availableIngredients
    );
    const formulation = await this.formulation.recomputeWithSubstitution(
      baseRequest,
      removeIngredientId,
      addIngredient,
      userId
    );
    return {
      payload: {
        ...formulation,
        isTheoretical: avail.isTheoretical,
        warning: avail.warning
      },
      formulation,
      isTheoretical: avail.isTheoretical,
      millProfileId: avail.millProfileId
    };
  }

  private async resolveSubstitute(
    addIngredientId: string,
    input: Record<string, unknown>,
    available: AvailableIngredientInput[]
  ): Promise<AvailableIngredientInput> {
    const fromAvail = available.find(
      (a) => a.feedIngredientId === addIngredientId
    );
    if (fromAvail) {
      return {
        feedIngredientId: addIngredientId,
        pricePerKg:
          input.addPricePerKg != null && Number(input.addPricePerKg) > 0
            ? Number(input.addPricePerKg)
            : fromAvail.pricePerKg,
        maxAvailableKg:
          input.addMaxAvailableKg != null && Number(input.addMaxAvailableKg) > 0
            ? Number(input.addMaxAvailableKg)
            : fromAvail.maxAvailableKg
      };
    }

    const ing = await this.prisma.feedIngredient.findUnique({
      where: { id: addIngredientId },
      select: { id: true, category: true, isActive: true }
    });
    if (!ing?.isActive) {
      throw new Error(`Intrant substitut introuvable : ${addIngredientId}`);
    }
    return {
      feedIngredientId: addIngredientId,
      pricePerKg:
        input.addPricePerKg != null && Number(input.addPricePerKg) > 0
          ? Number(input.addPricePerKg)
          : REFERENCE_PRICE_PER_KG[ing.category] ?? 300,
      maxAvailableKg:
        input.addMaxAvailableKg != null && Number(input.addMaxAvailableKg) > 0
          ? Number(input.addMaxAvailableKg)
          : THEORETICAL_MAX_AVAILABLE_KG
    };
  }

  private async buildFarmContext(
    dto: AssistFeedCompositionDto
  ): Promise<string> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId },
      select: { id: true, name: true, speciesFocus: true }
    });
    const animalCount = await this.prisma.animal.count({
      where: { farmId: dto.farmId, status: "active" }
    });

    const lines = [
      `Ferme : ${farm?.name ?? dto.farmId}`,
      `Espèce : ${farm?.speciesFocus ?? "porcin"}`,
      `Effectif animaux (approx.) : ${animalCount}`,
      dto.stageHint ? `Stade suggéré : ${dto.stageHint}` : null,
      dto.millId
        ? `Moulin ciblé : ${dto.millId}`
        : "Aucun moulin ciblé (prix de référence possibles)."
    ];
    return lines.filter(Boolean).join("\n");
  }
}

function parseStage(value: unknown): ProductionStage | null {
  if (typeof value !== "string") return null;
  return (Object.values(ProductionStage) as string[]).includes(value)
    ? (value as ProductionStage)
    : null;
}
