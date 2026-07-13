import { apiGetJson, apiPostJson, apiPutJson, apiPatchJson, apiDeleteJson } from "./http";

export type FeedTypeDto = {
  id: string;
  farmId: string;
  name: string;
  unit: "kg" | "tonne" | "sac";
  lowStockThresholdDays: number;
  color: string;
  weightPerBagKg: string | null;
  bagCountCurrent: string | null;
  lastCheckDate: string | null;
  lastEntryDate?: string | null;
  currentStockKg: string;
  productionPhase?: FeedProductionPhaseDto;
  phaseSuggestion?: FeedPhaseSuggestionDto | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedProductionPhaseDto =
  | "sous_mere"
  | "transition"
  | "starter"
  | "growth"
  | "fattening"
  | "breeder"
  | "unknown";

export type FeedPhaseSuggestionDto = {
  phase: FeedProductionPhaseDto;
  confidence: "high" | "medium" | "low";
  alternatives: FeedProductionPhaseDto[];
  label: string;
};

export type FeedStockComputedStatus = "ok" | "warning" | "critical" | "no_data";

export type FarmFeedOverviewDto = {
  farmId: string;
  totalStockKg: string;
  /** Statistiques enrichies par type (remplace `types` brut). */
  items: FarmFeedStatItemDto[];
};

export type FarmFeedChartSeriesDto = {
  feedTypeId: string;
  name: string;
  color: string;
  points: number[];
};

export type FarmFeedChartDto = {
  farmId: string;
  periodWeeks: number;
  weekKeys: string[];
  series: FarmFeedChartSeriesDto[];
};

export type FarmFeedStatItemDto = {
  feedTypeId: string;
  name: string;
  color: string;
  currentStockKg: string;
  weightPerBagKg: string | null;
  bagCountCurrent: string | null;
  lastCheckDate: string | null;
  avgDailyConsumptionKg: string | null;
  daysRemaining: number | null;
  estimatedDepletionDate: string | null;
  status: "ok" | "warning" | "critical";
  percentConsumed?: number | null;
  percentRemaining?: number | null;
  stockAtLastEntry?: string | null;
  daysSinceLastCheck?: number | null;
  hasSufficientData?: boolean;
  stockStatus?: FeedStockComputedStatus;
  stockStatusColor?: string;
};

export type FarmFeedStatsDto = {
  farmId: string;
  items: FarmFeedStatItemDto[];
};

export type SmartAlertModuleDto =
  | "stock"
  | "health"
  | "finance"
  | "gestation"
  | "cheptel"
  | "market";

export type SmartAlertPriorityDto = "critical" | "warning" | "info";

export type SmartAlertListItemDto = {
  id: string;
  ruleKey?: string;
  module: SmartAlertModuleDto;
  priority: SmartAlertPriorityDto;
  title: string;
  message: string;
  i18n?: {
    titleKey: string;
    messageKey: string;
    params?: Record<string, string | number>;
  };
  action?: {
    label: string;
    route: string;
    params?: Record<string, unknown>;
  };
  createdAt: string;
  isRead: boolean;
};

export type FarmSmartAlertsListDto = {
  farmId: string;
  items: SmartAlertListItemDto[];
};

export type FarmSmartAlertsCountDto = {
  farmId: string;
  criticalUnread: number;
};

export type FarmAlertSettingsDto = {
  id: string;
  farmId: string;
  mortalityRateThresholdPct: string | null;
  lowBalanceThreshold: string | null;
  stockWarningDays: number;
  stockCriticalDays: number;
  pushStock: boolean;
  pushHealth: boolean;
  pushFinance: boolean;
  pushGestation: boolean;
  pushCheptel: boolean;
  pushMarket: boolean;
};

export type FeedStockMovementDto = {
  id: string;
  farmId: string;
  feedTypeId: string;
  kind: "in" | "stock_check";
  quantityInput: string | null;
  quantityUnit: "kg" | "tonne" | "sac" | null;
  priceBasis: "kg" | "sac" | null;
  quantityKg: string | null;
  bagsCounted: string | null;
  bagsConsumed: string | null;
  daysSinceLastCheck: number | null;
  dailyConsumptionKg: string | null;
  stockAfterKg: string;
  supplier: string | null;
  unitPrice: string | null;
  totalCost: string | null;
  notes: string | null;
  occurredAt: string;
  linkedExpenseId: string | null;
  isCostMissing: boolean;
  reconciliationDismissedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  feedType: { id: string; name: string; unit: string };
};

export type ReconciliationOfferDto = {
  status: "single" | "multiple" | "none";
  movementId?: string;
  expenseId?: string;
  stock?: {
    movementId: string;
    feedTypeName: string;
    quantityKg: string;
    occurredAt: string;
    supplier: string | null;
  };
  finance?: {
    expenseId: string;
    amount: string;
    currency: string;
    label: string;
    occurredAt: string;
  };
  candidates?: Array<{
    expenseId: string;
    amount: string;
    currency: string;
    label: string;
    occurredAt: string;
    daysDelta: number;
  }>;
  calculatedUnitPricePerKg?: number;
  currency?: string;
};

export type PostFarmFeedMovementResponse = {
  movement: FeedStockMovementDto;
  reconciliation: ReconciliationOfferDto | null;
};

export function fetchFarmFeedTypes(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FeedTypeDto[]> {
  return apiGetJson<FeedTypeDto[]>(
    `/farms/${farmId}/feed/types`,
    accessToken,
    activeProfileId
  );
}

export function createFarmFeedType(
  accessToken: string,
  farmId: string,
  payload: {
    name: string;
    unit: "kg" | "tonne" | "sac";
    color?: string;
    weightPerBagKg?: number;
    lowStockThresholdDays?: number;
    productionPhase?: FeedProductionPhaseDto;
  },
  activeProfileId?: string | null
): Promise<FeedTypeDto> {
  return apiPostJson<FeedTypeDto>(
    `/farms/${farmId}/feed/types`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function updateFarmFeedType(
  accessToken: string,
  farmId: string,
  feedTypeId: string,
  payload: {
    name?: string;
    productionPhase?: FeedProductionPhaseDto;
  },
  activeProfileId?: string | null
): Promise<FeedTypeDto> {
  return apiPatchJson<FeedTypeDto>(
    `/farms/${farmId}/feed/types/${feedTypeId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFeedTypesPhaseReview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FeedTypeDto[]> {
  return apiGetJson<FeedTypeDto[]>(
    `/farms/${farmId}/feed/types/phase-review`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmFeedOverviewDto> {
  return apiGetJson<FarmFeedOverviewDto>(
    `/farms/${farmId}/feed/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedChart(
  accessToken: string,
  farmId: string,
  period: "3m" | "6m" | "12m",
  activeProfileId?: string | null
): Promise<FarmFeedChartDto> {
  return apiGetJson<FarmFeedChartDto>(
    `/farms/${farmId}/feed/chart?period=${encodeURIComponent(period)}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedStats(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmFeedStatsDto> {
  return apiGetJson<FarmFeedStatsDto>(
    `/farms/${farmId}/feed/stats`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmSmartAlerts(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  query?: { priority?: string; module?: string; unread?: string }
): Promise<FarmSmartAlertsListDto> {
  const qs = new URLSearchParams();
  if (query?.priority) qs.set("priority", query.priority);
  if (query?.module) qs.set("module", query.module);
  if (query?.unread) qs.set("unread", query.unread);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FarmSmartAlertsListDto>(
    `/farms/${farmId}/alerts${tail}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmSmartAlertsCount(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmSmartAlertsCountDto> {
  return apiGetJson<FarmSmartAlertsCountDto>(
    `/farms/${farmId}/alerts/count`,
    accessToken,
    activeProfileId
  );
}

export function postFarmSmartAlertsRefresh(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ synced: number }> {
  return apiPostJson<{ synced: number }>(
    `/farms/${farmId}/alerts/refresh`,
    {},
    accessToken,
    activeProfileId
  );
}

export function patchFarmSmartAlertRead(
  accessToken: string,
  farmId: string,
  alertId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPatchJson<{ ok: boolean }>(
    `/farms/${farmId}/alerts/${alertId}/read`,
    {},
    accessToken,
    activeProfileId
  );
}

export function deleteFarmSmartAlert(
  accessToken: string,
  farmId: string,
  alertId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/alerts/${alertId}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmAlertSettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmAlertSettingsDto> {
  return apiGetJson<FarmAlertSettingsDto>(
    `/farms/${farmId}/alert-settings`,
    accessToken,
    activeProfileId
  );
}

export function putFarmAlertSettings(
  accessToken: string,
  farmId: string,
  payload: Partial<{
    mortalityRateThresholdPct: number | null;
    lowBalanceThreshold: number | null;
    stockWarningDays: number;
    stockCriticalDays: number;
    pushStock: boolean;
    pushHealth: boolean;
    pushFinance: boolean;
    pushGestation: boolean;
    pushCheptel: boolean;
    pushMarket: boolean;
  }>,
  activeProfileId?: string | null
): Promise<FarmAlertSettingsDto> {
  return apiPutJson<FarmAlertSettingsDto>(
    `/farms/${farmId}/alert-settings`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedMovements(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  query?: { feedTypeId?: string; from?: string; to?: string }
): Promise<FeedStockMovementDto[]> {
  const qs = new URLSearchParams();
  if (query?.feedTypeId) qs.set("feedTypeId", query.feedTypeId);
  if (query?.from) qs.set("from", query.from);
  if (query?.to) qs.set("to", query.to);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FeedStockMovementDto[]>(
    `/farms/${farmId}/feed/movements${tail}`,
    accessToken,
    activeProfileId
  );
}

export type PostFarmFeedMovementPayload = {
  kind: "in" | "stock_check";
  feedTypeId?: string;
  newFeedType?: {
    name: string;
    unit: "kg" | "tonne" | "sac";
    color?: string;
    weightPerBagKg?: number;
    lowStockThresholdDays?: number;
  };
  quantityInput?: number;
  quantityUnit?: "kg" | "tonne" | "sac";
  weightPerBagKg?: number;
  bagsCounted?: number;
  supplier?: string;
  unitPrice?: number;
  priceBasis?: "kg" | "sac";
  notes?: string;
  occurredAt?: string;
};

export function postFarmFeedMovement(
  accessToken: string,
  farmId: string,
  payload: PostFarmFeedMovementPayload,
  activeProfileId?: string | null
): Promise<PostFarmFeedMovementResponse> {
  return apiPostJson<PostFarmFeedMovementResponse>(
    `/farms/${farmId}/feed/movements`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmFeedMovementPayload = {
  feedTypeId?: string;
  quantityInput?: number;
  quantityUnit?: "kg" | "tonne" | "sac";
  weightPerBagKg?: number;
  bagsCounted?: number;
  supplier?: string;
  unitPrice?: number;
  totalCost?: number;
  priceBasis?: "kg" | "sac";
  notes?: string;
  occurredAt?: string;
};

export function patchFarmFeedMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  payload: PatchFarmFeedMovementPayload,
  activeProfileId?: string | null
): Promise<PostFarmFeedMovementResponse> {
  return apiPatchJson<PostFarmFeedMovementResponse>(
    `/farms/${farmId}/feed/movements/${movementId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmFeedMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/feed/movements/${movementId}`,
    accessToken,
    activeProfileId
  );
}

export function reconcileFeedMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<{
  movementId: string;
  expenseId: string;
  unitPricePerKg: number;
  currency: string;
}> {
  return apiPostJson(
    `/farms/${farmId}/feed/movements/${movementId}/reconcile`,
    { expenseId },
    accessToken,
    activeProfileId
  );
}

export function rejectFeedReconciliation(
  accessToken: string,
  farmId: string,
  movementId: string,
  body: { expenseId: string; totalCost?: number; supplier?: string },
  activeProfileId?: string | null
): Promise<{ ok: boolean; expenseId?: string; amount?: string }> {
  return apiPostJson(
    `/farms/${farmId}/feed/movements/${movementId}/reject-reconciliation`,
    body,
    accessToken,
    activeProfileId
  );
}

export function dismissFeedReconciliation(
  accessToken: string,
  farmId: string,
  movementId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPostJson(
    `/farms/${farmId}/feed/movements/${movementId}/dismiss-reconciliation`,
    {},
    accessToken,
    activeProfileId
  );
}

