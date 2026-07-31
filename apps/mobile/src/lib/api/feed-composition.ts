import { apiGetJson, apiPostJson } from "./http";

export type ProductionStage =
  | "piglet_weaning"
  | "growing"
  | "fattening"
  | "finishing"
  | "gestating_sow"
  | "lactating_sow";

export type SavedCompositionSource = "ai_assisted" | "manual";
export type SavedCompositionStatus = "draft" | "vet_review" | "validated";

export type FeedCompositionChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type FeedRationLineDto = {
  feedIngredientId: string;
  canonicalName?: string;
  quantityKg: number;
  proportionPct: number;
  costContribution: number;
};

export type FeedNutritionResultDto = {
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  lysinePerMcal: number | null;
};

export type FeedNutrientDeviationDto = {
  nutrient: string;
  target: string;
  actual: number;
  withinBounds: boolean;
};

export type FeedFormulateResultDto = {
  feasible: boolean;
  ration: FeedRationLineDto[];
  totalFeedKg: number;
  dailyIntakeKg: number;
  totalCostXof: number;
  costPerKg: number;
  nutritionResult: FeedNutritionResultDto | null;
  deviations: FeedNutrientDeviationDto[];
  warnings: string[];
  infeasibilityReasons: string[];
};

export type FeedCompositionAssistResponse = {
  reply: string;
  formulation: FeedFormulateResultDto | null;
  isTheoretical: boolean;
  millProfileId: string | null;
  toolIterations: number;
  usage: { inputTokens: number; outputTokens: number };
  degradedHint: string | null;
};

export type FeedCompositionFormulateResponse = {
  formulation: FeedFormulateResultDto;
  isTheoretical: boolean;
  millProfileId: string | null;
  warning?: string;
};

export type SavedCompositionDto = {
  id: string;
  farmId: string;
  stage: ProductionStage;
  source: SavedCompositionSource;
  status: SavedCompositionStatus;
  inputParams: Record<string, unknown>;
  ration: FeedRationLineDto[] | Record<string, unknown>;
  nutritionResult: FeedNutritionResultDto | Record<string, unknown> | null;
  totalCostXof: number | string;
  millProfileId: string | null;
  isTheoretical: boolean;
  vetComment: string | null;
  vetReviewedBy: string | null;
  vetReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  chatRoomId?: string | null;
  vetConsultationId?: string | null;
  vetReviewedByName?: string | null;
  farmName?: string;
};

export type FarmCompositionVetDto = {
  userId: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
};

export type AssistFeedCompositionBody = {
  farmId: string;
  message: string;
  history?: FeedCompositionChatMessage[];
  stageHint?: ProductionStage;
  millId?: string;
};

export type FormulateFeedCompositionBody = {
  farmId: string;
  stage: ProductionStage;
  animalCount: number;
  avgWeightKg: number;
  avgAgeWeeks?: number;
  durationDays: number;
  millId?: string;
};

export type SaveCompositionBody = {
  farmId: string;
  stage: ProductionStage;
  source: SavedCompositionSource;
  inputParams: Record<string, unknown>;
  ration: FeedRationLineDto[] | Record<string, unknown>;
  nutritionResult?: FeedNutritionResultDto | Record<string, unknown>;
  totalCostXof: number;
  millProfileId?: string;
  isTheoretical?: boolean;
};

export function postFeedCompositionAssist(
  accessToken: string,
  body: AssistFeedCompositionBody,
  activeProfileId?: string | null
): Promise<FeedCompositionAssistResponse> {
  return apiPostJson<FeedCompositionAssistResponse>(
    "/feed-composition/assist",
    body,
    accessToken,
    activeProfileId
  );
}

export function postFeedCompositionFormulate(
  accessToken: string,
  body: FormulateFeedCompositionBody,
  activeProfileId?: string | null
): Promise<FeedCompositionFormulateResponse> {
  return apiPostJson<FeedCompositionFormulateResponse>(
    "/feed-composition/formulate",
    body,
    accessToken,
    activeProfileId
  );
}

export function saveFeedComposition(
  accessToken: string,
  body: SaveCompositionBody,
  activeProfileId?: string | null
): Promise<SavedCompositionDto> {
  return apiPostJson<SavedCompositionDto>(
    "/feed-composition/compositions",
    body,
    accessToken,
    activeProfileId
  );
}

export function listFeedCompositions(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<SavedCompositionDto[]> {
  const q = encodeURIComponent(farmId);
  return apiGetJson<SavedCompositionDto[]>(
    `/feed-composition/compositions?farmId=${q}`,
    accessToken,
    activeProfileId
  );
}

export function getFeedComposition(
  accessToken: string,
  compositionId: string,
  activeProfileId?: string | null
): Promise<SavedCompositionDto> {
  return apiGetJson<SavedCompositionDto>(
    `/feed-composition/compositions/${compositionId}`,
    accessToken,
    activeProfileId
  );
}

export function listFarmCompositionVeterinarians(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmCompositionVetDto[]> {
  return apiGetJson<FarmCompositionVetDto[]>(
    `/feed-composition/farms/${farmId}/veterinarians`,
    accessToken,
    activeProfileId
  );
}

export function requestCompositionVetReview(
  accessToken: string,
  compositionId: string,
  body: { veterinarianUserId?: string } = {},
  activeProfileId?: string | null
): Promise<SavedCompositionDto> {
  return apiPostJson<SavedCompositionDto>(
    `/feed-composition/compositions/${compositionId}/request-vet-review`,
    body,
    accessToken,
    activeProfileId
  );
}

export function reviewFeedComposition(
  accessToken: string,
  compositionId: string,
  body: { decision: "approve" | "request_changes"; comment?: string },
  activeProfileId?: string | null
): Promise<SavedCompositionDto> {
  return apiPostJson<SavedCompositionDto>(
    `/feed-composition/compositions/${compositionId}/vet-review`,
    body,
    accessToken,
    activeProfileId
  );
}

export function proposeCompositionAdjustment(
  accessToken: string,
  compositionId: string,
  body: {
    removeIngredientId: string;
    addIngredientId: string;
    addPricePerKg?: number;
    addMaxAvailableKg?: number;
    comment?: string;
  },
  activeProfileId?: string | null
): Promise<{ messageId: string; formulation: FeedFormulateResultDto }> {
  return apiPostJson(
    `/feed-composition/compositions/${compositionId}/propose-adjustment`,
    body,
    accessToken,
    activeProfileId
  );
}

export function applyCompositionAdjustment(
  accessToken: string,
  compositionId: string,
  body: { messageId: string },
  activeProfileId?: string | null
): Promise<SavedCompositionDto> {
  return apiPostJson<SavedCompositionDto>(
    `/feed-composition/compositions/${compositionId}/apply-adjustment`,
    body,
    accessToken,
    activeProfileId
  );
}

export function listPendingCompositionReviews(
  accessToken: string,
  activeProfileId?: string | null
): Promise<SavedCompositionDto[]> {
  return apiGetJson<SavedCompositionDto[]>(
    "/feed-composition/vet/pending-reviews",
    accessToken,
    activeProfileId
  );
}
