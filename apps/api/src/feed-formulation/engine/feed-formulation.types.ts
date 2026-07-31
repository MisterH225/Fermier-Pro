import type { ProductionStage } from "@prisma/client";
import type { FixedInclusion } from "./fixed-inclusions";

export type { FixedInclusion } from "./fixed-inclusions";

/** Snapshot nutritionnel d'un intrant (par kg matière brute). */
export type IngredientNutrition = {
  feedIngredientId: string;
  canonicalName?: string;
  category?: string;
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  fatPct?: number;
  dryMatterPct?: number;
  /** Si true : hors LP, uniquement via fixedInclusions du profil. */
  isPremix?: boolean;
};

/** Intrant disponible (déjà converti en prix/kg côté appelant). */
export type AvailableIngredientInput = {
  feedIngredientId: string;
  pricePerKg: number;
  maxAvailableKg: number;
};

/** Profil de besoins (nombres JS, pas Decimal Prisma). */
export type RequirementProfileSnapshot = {
  stage: ProductionStage;
  minCrudeProteinPct: number;
  maxCrudeProteinPct: number | null;
  minMetabolizableEnergyKcal: number;
  maxMetabolizableEnergyKcal: number | null;
  minLysinePct: number;
  minMethioninePct: number;
  minCalciumPct: number;
  maxCalciumPct: number | null;
  minPhosphorusPct: number;
  maxFiberPct: number | null;
  minLysinePerMcal: number | null;
  targetDailyIntakeKg: number | null;
  /**
   * Taux fixes prescrits pour le stade (CMV, sel…).
   * Posés avant l'optimisation ; leurs apports comptent dans le bilan.
   */
  fixedInclusions: FixedInclusion[];
};

export type FormulateInput = {
  stage: ProductionStage;
  animalCount: number;
  avgWeightKg: number;
  avgAgeWeeks?: number;
  durationDays: number;
  availableIngredients: AvailableIngredientInput[];
  /** Profil actif du stade (chargé par le service Nest). */
  profile: RequirementProfileSnapshot;
  /** Nutrition des intrants (même ids que availableIngredients + fixed). */
  nutritionById: Record<string, IngredientNutrition>;
};

export type RationLine = {
  feedIngredientId: string;
  /** Nom affichable (catalogue) — renseigné par le moteur quand dispo. */
  canonicalName?: string;
  quantityKg: number;
  proportionPct: number;
  costContribution: number;
};

export type NutritionResult = {
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  /** g lysine / Mcal EM — null si EM = 0. */
  lysinePerMcal: number | null;
};

export type NutrientDeviation = {
  nutrient: string;
  target: string;
  actual: number;
  withinBounds: boolean;
};

export type FormulateResult = {
  feasible: boolean;
  ration: RationLine[];
  totalFeedKg: number;
  dailyIntakeKg: number;
  totalCostXof: number;
  costPerKg: number;
  nutritionResult: NutritionResult | null;
  deviations: NutrientDeviation[];
  warnings: string[];
  /** Diagnostic quand feasible=false — nutriments non atteignables. */
  infeasibilityReasons: string[];
};

export type SubstitutionResult = FormulateResult & {
  /** Écart nutritionnel vs ration de base (points / kcal / %). */
  nutritionDelta: {
    crudeProteinPct: number;
    metabolizableEnergyKcal: number;
    lysinePct: number;
    methioninePct: number;
    calciumPct: number;
    phosphorusPct: number;
    crudeFiberPct: number;
    energyChangePct: number | null;
  } | null;
  baseFeasible: boolean;
};
