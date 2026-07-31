import {
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { ProductionStage } from "@prisma/client";
import { PlatformFeatureFlagsService } from "../feature-flags/platform-feature-flags.service";
import { FeedIngredientsService } from "../feed-ingredients/feed-ingredients.service";
import { FeedFormulationEngine } from "./engine/feed-formulation.engine";
import type {
  AvailableIngredientInput,
  FormulateInput,
  FormulateResult,
  IngredientNutrition,
  SubstitutionResult
} from "./engine/feed-formulation.types";
import { FeedRequirementProfilesService } from "./feed-requirement-profiles.service";
import { JavascriptLpSolver } from "./solver/javascript-lp.solver";
import { SOLVER_PORT, type SolverPort } from "./solver/solver.port";

export type FormulateRequest = {
  stage: ProductionStage;
  animalCount: number;
  avgWeightKg: number;
  avgAgeWeeks?: number;
  durationDays: number;
  /** Prix/kg déjà convertis (MillIngredientOffer → unitToKg côté appelant J3/J4). */
  availableIngredients: AvailableIngredientInput[];
};

/**
 * Façade Nest du moteur de formulation (module feed_composition).
 * Aucun endpoint public — appelé par J3/J4. Vérifie le flag à l'appel.
 */
@Injectable()
export class FeedFormulationService {
  private readonly engine: FeedFormulationEngine;

  constructor(
    private readonly profiles: FeedRequirementProfilesService,
    private readonly ingredients: FeedIngredientsService,
    private readonly platformFlags: PlatformFeatureFlagsService,
    @Inject(SOLVER_PORT) solver: SolverPort
  ) {
    this.engine = new FeedFormulationEngine(solver);
  }

  async formulate(
    request: FormulateRequest,
    userId?: string | null
  ): Promise<FormulateResult> {
    await this.assertModuleActive(userId);
    const input = await this.buildInput(request);
    return this.engine.formulate(input);
  }

  async recomputeWithSubstitution(
    request: FormulateRequest,
    removeIngredientId: string,
    addIngredient: AvailableIngredientInput,
    userId?: string | null
  ): Promise<SubstitutionResult> {
    await this.assertModuleActive(userId);
    const baseInput = await this.buildInput(request);
    const addNutrition = await this.loadNutrition(addIngredient.feedIngredientId);
    return this.engine.recomputeWithSubstitution(
      baseInput,
      removeIngredientId,
      { ...addIngredient, nutrition: addNutrition }
    );
  }

  /** Accès moteur pur (tests / callers internes déjà gated). */
  getEngine(): FeedFormulationEngine {
    return this.engine;
  }

  private async assertModuleActive(userId?: string | null): Promise<void> {
    const active = await this.platformFlags.isModuleActiveForUser(
      "feed_composition",
      userId
    );
    if (!active) {
      throw new ServiceUnavailableException({
        code: "MODULE_INACTIVE",
        message:
          "Le module Composition d'aliments (feed_composition) est inactif."
      });
    }
  }

  private async buildInput(request: FormulateRequest): Promise<FormulateInput> {
    const profile = await this.profiles.getActiveByStage(request.stage);
    const nutritionById: Record<string, IngredientNutrition> = {};
    const ids = new Set(request.availableIngredients.map((a) => a.feedIngredientId));
    for (const fi of profile.fixedInclusions) {
      ids.add(fi.feedIngredientId);
    }
    for (const id of ids) {
      nutritionById[id] = await this.loadNutrition(id);
    }
    return {
      stage: request.stage,
      animalCount: request.animalCount,
      avgWeightKg: request.avgWeightKg,
      avgAgeWeeks: request.avgAgeWeeks,
      durationDays: request.durationDays,
      availableIngredients: request.availableIngredients,
      profile,
      nutritionById
    };
  }

  private async loadNutrition(
    feedIngredientId: string
  ): Promise<IngredientNutrition> {
    const dto = await this.ingredients.getById(feedIngredientId);
    return {
      feedIngredientId: dto.id,
      canonicalName: dto.canonicalName,
      category: dto.category,
      crudeProteinPct: dto.crudeProteinPct,
      metabolizableEnergyKcal: dto.metabolizableEnergyKcal,
      lysinePct: dto.lysinePct,
      methioninePct: dto.methioninePct,
      calciumPct: dto.calciumPct,
      phosphorusPct: dto.phosphorusPct,
      crudeFiberPct: dto.crudeFiberPct,
      fatPct: dto.fatPct,
      dryMatterPct: dto.dryMatterPct,
      isPremix: dto.isPremix
    };
  }
}

/** Factory utilitaire pour tests unitaires sans Nest DI. */
export function createFeedFormulationEngine(
  solver: SolverPort = new JavascriptLpSolver()
): FeedFormulationEngine {
  return new FeedFormulationEngine(solver);
}
