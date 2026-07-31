/**
 * Explication structurée d'une ration — générée par Gemini ou fallback factuel.
 * Les nombres affichés viennent toujours des données fournies (anti-hallucination).
 */

export type IngredientJustification = {
  feedIngredientId: string;
  name: string;
  text: string;
};

export type CompositionExplanation = {
  /** Ce dont les animaux ont besoin à ce stade (et pourquoi). */
  stageNeeds: string;
  /** Justification de chaque intrant majeur. */
  ingredientJustifications: IngredientJustification[];
  /** kcal/kg — copie exacte de nutritionResult (jamais inventé). */
  energyKcalPerKg: number;
  /** Commentaire énergie / objectif porc sans graisse. */
  energyComment: string;
  /** Écarts nutritionnels notables (vide si tout OK). */
  notableDeviations: string[];
  source: "ai" | "factual_fallback";
  /** Empreinte ration — invalide le cache si la ration change. */
  rationFingerprint: string;
};

export type ExplainCompositionResponse = {
  explanation: CompositionExplanation;
  cached: boolean;
  usage: { inputTokens: number; outputTokens: number } | null;
};

export type RationLineForExplain = {
  feedIngredientId: string;
  canonicalName?: string;
  quantityKg: number;
  proportionPct: number;
};

export type NutritionForExplain = {
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  lysinePerMcal?: number | null;
};

export type DeviationForExplain = {
  nutrient: string;
  target: string;
  actual: number;
  withinBounds: boolean;
};

export type IngredientRoleContext = {
  feedIngredientId: string;
  name: string;
  category: string;
  categoryLabelFr: string;
  dominantNutrients: string[];
  proportionPct: number;
};
