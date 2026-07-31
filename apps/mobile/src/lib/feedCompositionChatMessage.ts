export const FEED_COMPOSITION_CARD_TYPE = "feed_composition_card" as const;

export type FeedCompositionCardVariant =
  | "initial"
  | "adjustment"
  | "validated"
  | "request_changes";

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
  ration: Array<{
    feedIngredientId: string;
    canonicalName?: string;
    quantityKg: number;
    proportionPct: number;
    costContribution: number;
  }>;
  nutritionResult: {
    crudeProteinPct: number;
    metabolizableEnergyKcal: number;
    lysinePct: number;
    methioninePct: number;
    calciumPct: number;
    phosphorusPct: number;
    crudeFiberPct: number;
    lysinePerMcal: number | null;
  } | null;
  deviations: Array<{
    nutrient: string;
    target: string;
    actual: number;
    withinBounds: boolean;
  }>;
  infeasibilityReasons: string[];
  nutritionDelta: Record<string, number | null> | null;
  versionId: string;
  proposedByUserId: string;
  note?: string | null;
};

export function parseFeedCompositionCardMessage(
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
