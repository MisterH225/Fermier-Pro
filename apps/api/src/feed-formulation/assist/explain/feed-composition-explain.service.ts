import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { ProductionStage, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AiGeminiService } from "../../../ai/ai-gemini.service";
import { FarmAccessService } from "../../../common/farm-access.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { RequirementProfileSnapshot } from "../../engine/feed-formulation.types";
import { FeedRequirementProfilesService } from "../../feed-requirement-profiles.service";
import type { ExplainFeedCompositionDto } from "../dto/feed-composition.dto";
import {
  buildEnergyComment,
  buildFactualExplanation,
  dedupeNotableDeviations
} from "./build-factual-explanation";
import {
  assertNoHallucinatedNumbers,
  buildExplainPrompt,
  collectAllowedNumbers
} from "./build-explain-prompt";
import type {
  CompositionExplanation,
  DeviationForExplain,
  ExplainCompositionResponse,
  NutritionForExplain,
  RationLineForExplain
} from "./composition-explanation.types";
import { buildIngredientRoles } from "./ingredient-roles";
import {
  computeRationFingerprint,
  parseCachedExplanation
} from "./ration-fingerprint";

@Injectable()
export class FeedCompositionExplainService {
  private readonly logger = new Logger(FeedCompositionExplainService.name);

  constructor(
    private readonly gemini: AiGeminiService,
    private readonly profiles: FeedRequirementProfilesService,
    private readonly farmAccess: FarmAccessService,
    private readonly prisma: PrismaService
  ) {}

  async explain(
    user: User,
    dto: ExplainFeedCompositionDto
  ): Promise<ExplainCompositionResponse> {
    await this.farmAccess.requireFarmAccess(user.id, dto.farmId);

    const ration = normalizeRation(dto.ration);
    if (ration.length === 0) {
      throw new BadRequestException("Ration vide — rien à expliquer");
    }
    const nutrition = normalizeNutrition(dto.nutritionResult);
    if (!nutrition) {
      throw new BadRequestException(
        "nutritionResult requis pour expliquer la ration"
      );
    }
    const deviations = normalizeDeviations(dto.deviations);

    const fingerprint = computeRationFingerprint(
      dto.stage,
      ration,
      nutrition
    );

    if (dto.savedCompositionId && !dto.forceRefresh) {
      const cached = await this.readCache(
        user,
        dto.savedCompositionId,
        fingerprint
      );
      if (cached) {
        return { explanation: cached, cached: true, usage: null };
      }
    }

    const profile = await this.profiles.getActiveByStage(dto.stage);
    const roles = await this.resolveRoles(ration);

    const context = {
      stage: dto.stage,
      animalCount: dto.animalCount,
      avgWeightKg: dto.avgWeightKg,
      avgAgeWeeks: dto.avgAgeWeeks,
      profile,
      nutrition,
      deviations,
      roles,
      rationFingerprint: fingerprint
    };

    let explanation: CompositionExplanation;
    let usage: { inputTokens: number; outputTokens: number } | null = null;

    const ai = await this.tryAiExplanation(context);
    if (ai) {
      explanation = ai.explanation;
      usage = ai.usage;
    } else {
      explanation = buildFactualExplanation(context);
    }

    if (dto.savedCompositionId) {
      await this.writeCache(dto.savedCompositionId, user.id, explanation);
    }

    return { explanation, cached: false, usage };
  }

  private async tryAiExplanation(context: {
    stage: ProductionStage;
    animalCount: number;
    avgWeightKg?: number | null;
    avgAgeWeeks?: number | null;
    profile: RequirementProfileSnapshot;
    nutrition: NutritionForExplain;
    deviations: DeviationForExplain[];
    roles: ReturnType<typeof buildIngredientRoles>;
    rationFingerprint: string;
  }): Promise<{
    explanation: CompositionExplanation;
    usage: { inputTokens: number; outputTokens: number };
  } | null> {
    if (!this.gemini.isConfigured() || this.gemini.isQuotaBlocked()) {
      return null;
    }

    const prompt = buildExplainPrompt(context);
    const raw = await this.gemini.generateJson(prompt, {
      maxOutputTokens: 1536,
      timeoutMs: 20_000
    });
    if (!raw?.text) return null;

    this.gemini.logGenerateUsage(raw.usage, {
      purpose: "feed_composition_explain"
    });

    try {
      const parsed = JSON.parse(raw.text) as {
        stageNeeds?: unknown;
        ingredientJustifications?: unknown;
        energyComment?: unknown;
        notableDeviations?: unknown;
      };

      const stageNeeds =
        typeof parsed.stageNeeds === "string" ? parsed.stageNeeds.trim() : "";
      const energyComment =
        typeof parsed.energyComment === "string"
          ? parsed.energyComment.trim()
          : "";
      if (!stageNeeds || !energyComment) return null;

      const justifications = Array.isArray(parsed.ingredientJustifications)
        ? parsed.ingredientJustifications
            .map((j) => {
              if (j == null || typeof j !== "object") return null;
              const o = j as Record<string, unknown>;
              const id = String(o.feedIngredientId ?? "").trim();
              const name = String(o.name ?? "").trim();
              const text = String(o.text ?? "").trim();
              if (!id || !name || !text) return null;
              return { feedIngredientId: id, name, text };
            })
            .filter(
              (x): x is { feedIngredientId: string; name: string; text: string } =>
                x != null
            )
        : [];

      // Compléter les intrants manquants avec le fallback factuel local.
      const factual = buildFactualExplanation(context);
      const byId = new Map(
        justifications.map((j) => [j.feedIngredientId, j])
      );
      for (const f of factual.ingredientJustifications) {
        if (!byId.has(f.feedIngredientId)) {
          justifications.push(f);
        }
      }

      let notableDeviations: string[] = Array.isArray(parsed.notableDeviations)
        ? parsed.notableDeviations
            .map((s) => String(s).trim())
            .filter(Boolean)
        : [];
      if (notableDeviations.length === 0) {
        notableDeviations = dedupeNotableDeviations(context.deviations);
      }

      const texts = [
        stageNeeds,
        energyComment,
        ...justifications.map((j) => j.text),
        ...notableDeviations
      ];
      const allowed = collectAllowedNumbers(context);
      if (!assertNoHallucinatedNumbers(texts, allowed)) {
        this.logger.warn(
          "Explication IA rejetée : chiffres hors données fournies"
        );
        return null;
      }

      // Forcer l'énergie fournie (jamais celle « inventée » dans le texte seul).
      const energyKcalPerKg = context.nutrition.metabolizableEnergyKcal;
      const safeEnergyComment = energyComment.includes(
        String(Math.round(energyKcalPerKg))
      ) || energyComment.includes(String(energyKcalPerKg))
        ? energyComment
        : buildEnergyComment(
            context.stage,
            energyKcalPerKg,
            context.profile.maxMetabolizableEnergyKcal ?? null,
            context.profile.minMetabolizableEnergyKcal
          ) +
          (energyComment ? ` ${energyComment}` : "");

      return {
        explanation: {
          stageNeeds,
          ingredientJustifications: justifications,
          energyKcalPerKg,
          energyComment: safeEnergyComment,
          notableDeviations,
          source: "ai",
          rationFingerprint: context.rationFingerprint
        },
        usage: raw.usage
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Parse explication IA échoué: ${msg}`);
      return null;
    }
  }

  private async resolveRoles(ration: RationLineForExplain[]) {
    const ids = [...new Set(ration.map((r) => r.feedIngredientId))];
    const rows = await this.prisma.feedIngredient.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        canonicalName: true,
        category: true,
        crudeProteinPct: true,
        metabolizableEnergyKcal: true,
        lysinePct: true,
        calciumPct: true,
        phosphorusPct: true
      }
    });
    const byId = new Map(
      rows.map((r) => [
        r.id,
        {
          canonicalName: r.canonicalName,
          category: r.category,
          crudeProteinPct: Number(r.crudeProteinPct),
          metabolizableEnergyKcal: Number(r.metabolizableEnergyKcal),
          lysinePct: Number(r.lysinePct),
          calciumPct: Number(r.calciumPct),
          phosphorusPct: Number(r.phosphorusPct)
        }
      ])
    );
    return buildIngredientRoles(ration, byId);
  }

  private async readCache(
    user: User,
    compositionId: string,
    fingerprint: string
  ): Promise<CompositionExplanation | null> {
    const row = await this.prisma.savedComposition.findUnique({
      where: { id: compositionId }
    });
    if (!row) return null;
    await this.farmAccess.requireFarmAccess(user.id, row.farmId);
    const parsed = parseCachedExplanation(row.explanation);
    if (!parsed || parsed.rationFingerprint !== fingerprint) return null;
    return parsed.payload as unknown as CompositionExplanation;
  }

  private async writeCache(
    compositionId: string,
    userId: string,
    explanation: CompositionExplanation
  ): Promise<void> {
    const row = await this.prisma.savedComposition.findUnique({
      where: { id: compositionId },
      select: { id: true, farmId: true }
    });
    if (!row) {
      throw new NotFoundException("Composition introuvable pour le cache");
    }
    await this.farmAccess.requireFarmAccess(userId, row.farmId);
    await this.prisma.savedComposition.update({
      where: { id: compositionId },
      data: {
        explanation: explanation as unknown as Prisma.InputJsonValue
      }
    });
  }
}

function normalizeRation(raw: unknown): RationLineForExplain[] {
  if (!Array.isArray(raw)) return [];
  const out: RationLineForExplain[] = [];
  for (const l of raw) {
    if (l == null || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    const id = String(o.feedIngredientId ?? "").trim();
    if (!id) continue;
    const line: RationLineForExplain = {
      feedIngredientId: id,
      quantityKg: Number(o.quantityKg) || 0,
      proportionPct: Number(o.proportionPct) || 0
    };
    if (typeof o.canonicalName === "string") {
      line.canonicalName = o.canonicalName;
    }
    out.push(line);
  }
  return out;
}

function normalizeNutrition(raw: unknown): NutritionForExplain | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const me = Number(o.metabolizableEnergyKcal);
  const cp = Number(o.crudeProteinPct);
  if (!Number.isFinite(me) || !Number.isFinite(cp)) return null;
  return {
    crudeProteinPct: cp,
    metabolizableEnergyKcal: me,
    lysinePct: Number(o.lysinePct) || 0,
    methioninePct: Number(o.methioninePct) || 0,
    calciumPct: Number(o.calciumPct) || 0,
    phosphorusPct: Number(o.phosphorusPct) || 0,
    crudeFiberPct: Number(o.crudeFiberPct) || 0,
    lysinePerMcal:
      o.lysinePerMcal == null ? null : Number(o.lysinePerMcal)
  };
}

function normalizeDeviations(raw: unknown): DeviationForExplain[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => {
      if (d == null || typeof d !== "object") return null;
      const o = d as Record<string, unknown>;
      const nutrient = String(o.nutrient ?? "").trim();
      if (!nutrient) return null;
      return {
        nutrient,
        target: String(o.target ?? ""),
        actual: Number(o.actual) || 0,
        withinBounds: Boolean(o.withinBounds)
      };
    })
    .filter((x): x is DeviationForExplain => x != null);
}
