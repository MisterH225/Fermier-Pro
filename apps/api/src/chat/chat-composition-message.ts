/** Carte composition structurée dans un ChatMessage (body JSON). */

export const FEED_COMPOSITION_CARD_TYPE = "feed_composition_card" as const;

export type FeedCompositionCardVariant =
  | "initial"
  | "adjustment"
  | "validated"
  | "request_changes";

export type FeedCompositionRationLinePayload = {
  feedIngredientId: string;
  canonicalName?: string;
  quantityKg: number;
  proportionPct: number;
  costContribution: number;
};

export type FeedCompositionNutritionPayload = {
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  lysinePerMcal: number | null;
};

export type FeedCompositionDeviationPayload = {
  nutrient: string;
  target: string;
  actual: number;
  withinBounds: boolean;
};

export type FeedCompositionCardPayload = {
  _type: typeof FEED_COMPOSITION_CARD_TYPE;
  variant: FeedCompositionCardVariant;
  compositionId: string;
  farmId: string;
  stage: string;
  status: string;
  feasible: boolean;
  totalCostXof: number;
  costPerKg: number;
  totalFeedKg: number;
  dailyIntakeKg: number;
  ration: FeedCompositionRationLinePayload[];
  nutritionResult: FeedCompositionNutritionPayload | null;
  deviations: FeedCompositionDeviationPayload[];
  infeasibilityReasons: string[];
  /** Écart vs version précédente (ajustement véto). */
  nutritionDelta: Record<string, number | null> | null;
  /** Id CompositionAdjustmentProposal (si proposée via le modèle). */
  proposalId?: string | null;
  /** Alerte anti-gras : énergie au-dessus / proche du plafond du stade. */
  fatRiskAlert?: boolean;
  versionId: string;
  proposedByUserId: string;
  note?: string | null;
};

export function buildFeedCompositionCardBody(
  payload: FeedCompositionCardPayload
): string {
  return JSON.stringify(payload);
}

export function parseFeedCompositionCardBody(
  body: string
): FeedCompositionCardPayload | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<FeedCompositionCardPayload>;
    if (
      parsed._type !== FEED_COMPOSITION_CARD_TYPE ||
      !parsed.compositionId ||
      !parsed.versionId
    ) {
      return null;
    }
    return parsed as FeedCompositionCardPayload;
  } catch {
    return null;
  }
}

export function feedCompositionCardPreview(
  payload: FeedCompositionCardPayload
): string {
  const cost = Math.round(payload.totalCostXof).toLocaleString("fr-FR");
  if (payload.variant === "adjustment") {
    return `Ajustement proposé · ${cost} F · ${payload.stage}`;
  }
  if (payload.variant === "validated") {
    return `Composition validée · ${cost} F`;
  }
  return `Composition à valider · ${cost} F · ${payload.stage}`;
}
