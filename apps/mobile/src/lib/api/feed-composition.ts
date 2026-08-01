import { apiGetJson, apiPatchJson, apiPostJson } from "./http";

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

export type IngredientJustificationDto = {
  feedIngredientId: string;
  name: string;
  text: string;
};

/** Explication structurée (IA Gemini ou fallback factuel). */
export type CompositionExplanationDto = {
  stageNeeds: string;
  ingredientJustifications: IngredientJustificationDto[];
  energyKcalPerKg: number;
  energyComment: string;
  notableDeviations: string[];
  source: "ai" | "factual_fallback";
  rationFingerprint: string;
};

export type ExplainCompositionResponse = {
  explanation: CompositionExplanationDto;
  cached: boolean;
  usage: { inputTokens: number; outputTokens: number } | null;
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
  explanation?: CompositionExplanationDto | Record<string, unknown> | null;
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

export type ExplainFeedCompositionBody = {
  farmId: string;
  stage: ProductionStage;
  animalCount: number;
  avgWeightKg?: number;
  avgAgeWeeks?: number;
  ration: FeedRationLineDto[];
  nutritionResult: FeedNutritionResultDto;
  deviations?: FeedNutrientDeviationDto[];
  savedCompositionId?: string;
  forceRefresh?: boolean;
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

export type CompositionAdjustmentPreviewDto = {
  feasible: boolean;
  formulation: FeedFormulateResultDto;
  deviationFromCurrent: {
    crudeProteinPct: number;
    metabolizableEnergyKcal: number;
    lysinePct: number;
    methioninePct: number;
    calciumPct: number;
    phosphorusPct: number;
    crudeFiberPct: number;
    energyChangePct: number | null;
    fatRiskAlert: boolean;
    energyCapKcal: number | null;
  };
  fatRiskAlert: boolean;
  infeasibilityReasons: string[];
};

export type CompositionAdjustmentProposeDto = {
  proposalId: string;
  messageId: string;
  formulation: FeedFormulateResultDto;
  deviationFromCurrent: CompositionAdjustmentPreviewDto["deviationFromCurrent"];
  fatRiskAlert: boolean;
};

/** Prévisualise un ajustement (moteur) sans persister. */
export function previewCompositionAdjustment(
  accessToken: string,
  compositionId: string,
  body: {
    removeIngredientId: string;
    addIngredientId: string;
    addPricePerKg?: number;
    addMaxAvailableKg?: number;
  },
  activeProfileId?: string | null
): Promise<CompositionAdjustmentPreviewDto> {
  return apiPostJson(
    `/feed-composition/compositions/${compositionId}/vet-adjustment/preview`,
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
): Promise<CompositionAdjustmentProposeDto> {
  return apiPostJson(
    `/feed-composition/compositions/${compositionId}/vet-adjustment`,
    body,
    accessToken,
    activeProfileId
  );
}

export function applyCompositionAdjustment(
  accessToken: string,
  compositionId: string,
  body: { proposalId?: string; messageId?: string },
  activeProfileId?: string | null
): Promise<SavedCompositionDto> {
  if (body.proposalId) {
    return apiPostJson<SavedCompositionDto>(
      `/feed-composition/compositions/${compositionId}/adjustment/${body.proposalId}/apply`,
      {},
      accessToken,
      activeProfileId
    );
  }
  return apiPostJson<SavedCompositionDto>(
    `/feed-composition/compositions/${compositionId}/apply-adjustment`,
    body,
    accessToken,
    activeProfileId
  );
}

export function rejectCompositionAdjustment(
  accessToken: string,
  compositionId: string,
  proposalId: string,
  body?: { comment?: string },
  activeProfileId?: string | null
): Promise<{ proposalId: string; status: "rejected" }> {
  return apiPostJson(
    `/feed-composition/compositions/${compositionId}/adjustment/${proposalId}/reject`,
    body ?? {},
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

export function postFeedCompositionExplain(
  accessToken: string,
  body: ExplainFeedCompositionBody,
  activeProfileId?: string | null
): Promise<ExplainCompositionResponse> {
  return apiPostJson<ExplainCompositionResponse>(
    "/feed-composition/explain",
    body,
    accessToken,
    activeProfileId
  );
}

// ─── Mill prices & composition orders (P-J4-C) ───────────────────────────────

export type CompositionOrderStatus =
  | "SENT_TO_MILL"
  | "MILL_REVISED"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "PAID"
  | "IN_PRODUCTION"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED";

export type MillCompositionMissingIngredientDto = {
  feedIngredientId: string;
  canonicalName: string | null;
  requiredKg: number;
  reason: "no_offer" | "insufficient_stock";
  availableKg: number | null;
};

export type MillCompositionPriceDto = {
  millId: string;
  millName: string;
  distanceKm: number | null;
  totalPriceXof: number;
  missingIngredients: MillCompositionMissingIngredientDto[];
  availabilityComplete: boolean;
  mixingCost: number;
};

export type MillPricesResponseDto = {
  compositionId: string;
  farmId: string;
  radiusKm: number;
  mills: MillCompositionPriceDto[];
};

export type CompositionOrderDto = {
  id: string;
  savedCompositionId: string;
  farmId: string;
  producerUserId: string;
  millProfileId: string;
  status: CompositionOrderStatus;
  snapshotRation: FeedRationLineDto[] | Record<string, unknown>;
  quotedPriceXof: number;
  finalPriceXof: number | null;
  millNote: string | null;
  productionStartEstimate: string | null;
  readyEstimate: string | null;
  productionStartedAt: string | null;
  readyActual: string | null;
  escrowTransactionRef: string | null;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCompositionOrderBody = {
  millProfileId: string;
  radiusKm?: number;
};

export type ReviseCompositionOrderBody = {
  millNote?: string;
  removeIngredientId?: string;
  addIngredientId?: string;
  addPricePerKg?: number;
  productionStartEstimate: string;
  readyEstimate: string;
};

export type PayCompositionOrderResponse = {
  orderId: string;
  providerRef: string;
  amount: number;
  currency: string;
  paymentMethod: "wallet" | "mobile_money";
  paymentUrl: string | null;
};

export function fetchCompositionMillPrices(
  accessToken: string,
  compositionId: string,
  radiusKm?: number,
  activeProfileId?: string | null
): Promise<MillPricesResponseDto> {
  const q =
    radiusKm != null && radiusKm > 0
      ? `?radiusKm=${encodeURIComponent(String(radiusKm))}`
      : "";
  return apiGetJson<MillPricesResponseDto>(
    `/feed-composition/compositions/${compositionId}/mill-prices${q}`,
    accessToken,
    activeProfileId
  );
}

export function createCompositionOrder(
  accessToken: string,
  compositionId: string,
  body: CreateCompositionOrderBody,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/compositions/${compositionId}/orders`,
    body,
    accessToken,
    activeProfileId
  );
}

export function fetchCompositionOrder(
  accessToken: string,
  orderId: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiGetJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}`,
    accessToken,
    activeProfileId
  );
}

export function acceptCompositionOrder(
  accessToken: string,
  orderId: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/accept`,
    {},
    accessToken,
    activeProfileId
  );
}

export function rejectCompositionOrder(
  accessToken: string,
  orderId: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/reject`,
    {},
    accessToken,
    activeProfileId
  );
}

export function cancelCompositionOrder(
  accessToken: string,
  orderId: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/cancel`,
    {},
    accessToken,
    activeProfileId
  );
}

export function payCompositionOrder(
  accessToken: string,
  orderId: string,
  body: { paymentMethod?: "wallet" | "mobile_money" } = {},
  activeProfileId?: string | null
): Promise<PayCompositionOrderResponse> {
  return apiPostJson<PayCompositionOrderResponse>(
    `/feed-composition/orders/${orderId}/pay`,
    body,
    accessToken,
    activeProfileId
  );
}

export function confirmCompositionOrderPayment(
  accessToken: string,
  orderId: string,
  providerRef?: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/confirm-payment`,
    providerRef ? { providerRef } : {},
    accessToken,
    activeProfileId
  );
}

export function reviseCompositionOrder(
  accessToken: string,
  orderId: string,
  body: ReviseCompositionOrderBody,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/mill-revise`,
    body,
    accessToken,
    activeProfileId
  );
}

export function updateCompositionReadyEstimate(
  accessToken: string,
  orderId: string,
  readyEstimate: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPatchJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/ready-estimate`,
    { readyEstimate },
    accessToken,
    activeProfileId
  );
}

export function startCompositionProduction(
  accessToken: string,
  orderId: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/start-production`,
    {},
    accessToken,
    activeProfileId
  );
}

export function markCompositionReady(
  accessToken: string,
  orderId: string,
  activeProfileId?: string | null
): Promise<CompositionOrderDto> {
  return apiPostJson<CompositionOrderDto>(
    `/feed-composition/orders/${orderId}/mark-ready`,
    {},
    accessToken,
    activeProfileId
  );
}
