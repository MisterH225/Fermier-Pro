import { apiGetJson, apiPostJson, apiPutJson, apiPatchJson, apiDeleteJson } from "./http";
import type { ReconciliationOfferDto } from "./feed-stock";

/** Finance — scopes finance.read / finance.write. */
export type FinanceSummaryDto = {
  farmId: string;
  totalExpenses: string;
  totalRevenues: string;
  net: string;
  currency: string;
  currencySymbol?: string;
};

export type FarmExpenseDto = {
  id: string;
  farmId: string;
  amount: string | number;
  currency: string;
  label: string;
  category: string | null;
  note: string | null;
  occurredAt: string;
  createdByUserId: string;
  creator?: { id: string; fullName: string | null; email: string | null };
};

export type FarmRevenueDto = {
  id: string;
  farmId: string;
  amount: string | number;
  currency: string;
  label: string;
  category: string | null;
  note: string | null;
  occurredAt: string;
  createdByUserId: string;
  creator?: { id: string; fullName: string | null; email: string | null };
};

export function fetchFinanceSummary(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  range?: { from?: string; to?: string }
): Promise<FinanceSummaryDto> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FinanceSummaryDto>(
    `/farms/${farmId}/finance/summary${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmExpenses(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  range?: { from?: string; to?: string }
): Promise<FarmExpenseDto[]> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FarmExpenseDto[]>(
    `/farms/${farmId}/finance/expenses${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmRevenues(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  range?: { from?: string; to?: string }
): Promise<FarmRevenueDto[]> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FarmRevenueDto[]>(
    `/farms/${farmId}/finance/revenues${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<FarmExpenseDto> {
  return apiGetJson<FarmExpenseDto>(
    `/farms/${farmId}/finance/expenses/${expenseId}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmRevenue(
  accessToken: string,
  farmId: string,
  revenueId: string,
  activeProfileId?: string | null
): Promise<FarmRevenueDto> {
  return apiGetJson<FarmRevenueDto>(
    `/farms/${farmId}/finance/revenues/${revenueId}`,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmExpensePayload = {
  amount: number;
  currency?: string;
  label: string;
  category?: string;
  note?: string;
  occurredAt?: string;
};

export type CreateFarmExpenseResponse = FarmExpenseDto & {
  reconciliation?: ReconciliationOfferDto | null;
};

export function createFarmExpense(
  accessToken: string,
  farmId: string,
  payload: CreateFarmExpensePayload,
  activeProfileId?: string | null
): Promise<CreateFarmExpenseResponse> {
  return apiPostJson<CreateFarmExpenseResponse>(
    `/farms/${farmId}/finance/expenses`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmRevenuePayload = {
  amount: number;
  currency?: string;
  label: string;
  category?: string;
  note?: string;
  occurredAt?: string;
};

export function createFarmRevenue(
  accessToken: string,
  farmId: string,
  payload: CreateFarmRevenuePayload,
  activeProfileId?: string | null
): Promise<FarmRevenueDto> {
  return apiPostJson<FarmRevenueDto>(
    `/farms/${farmId}/finance/revenues`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/expenses/${expenseId}`,
    accessToken,
    activeProfileId
  );
}

export type LinkedStockMovementSummaryDto = {
  id: string;
  feedTypeId: string;
  feedTypeName: string;
  quantityKg: string | null;
  unitPrice: string | null;
  supplier: string | null;
  occurredAt: string;
};

export type LinkedStockForExpenseDto = {
  expenseId: string;
  movements: LinkedStockMovementSummaryDto[];
};

/** GET /farms/:farmId/finance/expenses/:expenseId/linked-stock */
export function fetchLinkedStockForExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<LinkedStockForExpenseDto> {
  return apiGetJson<LinkedStockForExpenseDto>(
    `/farms/${farmId}/finance/expenses/${expenseId}/linked-stock`,
    accessToken,
    activeProfileId
  );
}

export type LinkedTransactionForMovementDto = {
  movementId: string;
  expense: {
    id: string;
    amount: string;
    currency: string;
    label: string;
    occurredAt: string;
    categoryKey: string | null;
  } | null;
};

/** GET /farms/:farmId/feed/movements/:movementId/linked-transaction */
export function fetchLinkedTransactionForMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  activeProfileId?: string | null
): Promise<LinkedTransactionForMovementDto> {
  return apiGetJson<LinkedTransactionForMovementDto>(
    `/farms/${farmId}/feed/movements/${movementId}/linked-transaction`,
    accessToken,
    activeProfileId
  );
}

/** DELETE /farms/:farmId/finance/expenses/:expenseId/with-stock */
export function deleteFarmExpenseWithStock(
  accessToken: string,
  farmId: string,
  expenseId: string,
  deleteStock: boolean,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  const q = deleteStock ? "?deleteStock=true" : "?deleteStock=false";
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/expenses/${expenseId}/with-stock${q}`,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmRevenue(
  accessToken: string,
  farmId: string,
  revenueId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/revenues/${revenueId}`,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmExpensePayload = {
  amount?: number;
  currency?: string;
  label?: string;
  category?: string | null;
  note?: string | null;
  occurredAt?: string;
};

export function patchFarmExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  payload: PatchFarmExpensePayload,
  activeProfileId?: string | null
): Promise<FarmExpenseDto> {
  return apiPatchJson<FarmExpenseDto>(
    `/farms/${farmId}/finance/expenses/${expenseId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmRevenuePayload = {
  amount?: number;
  currency?: string;
  label?: string;
  category?: string | null;
  note?: string | null;
  occurredAt?: string;
};

export function patchFarmRevenue(
  accessToken: string,
  farmId: string,
  revenueId: string,
  payload: PatchFarmRevenuePayload,
  activeProfileId?: string | null
): Promise<FarmRevenueDto> {
  return apiPatchJson<FarmRevenueDto>(
    `/farms/${farmId}/finance/revenues/${revenueId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type FinanceOverviewMonthPoint = {
  month: string;
  expenses: string;
  revenues: string;
  currency: string;
};

export type FinanceOverviewDto = {
  farmId: string;
  settings: {
    currencyCode: string;
    currencySymbol: string;
    lowBalanceThreshold: string | null;
  };
  month: {
    totalExpenses: string;
    totalRevenues: string;
    netMargin: string;
  };
  balanceAllTime: string;
  balanceAllTimeWithHistorical?: string;
  historical?: {
    totalIncome: string;
    totalExpense: string;
    netResult: string;
    recordsCount: number;
  };
  lowBalanceWarning: boolean;
  /** Série mensuelle sur les 6 derniers mois (revenus / dépenses). */
  months6: FinanceOverviewMonthPoint[];
  /** @deprecated Utiliser months6 — 3 derniers mois seulement. */
  months3?: FinanceOverviewMonthPoint[];
};

export type FinanceCategoryDto = {
  id: string;
  farmId: string;
  type: string;
  key: string;
  name: string;
  icon: string | null;
  isDefault: boolean;
};

export type FinanceMergedTransactionDto = {
  id: string;
  kind: "expense" | "income";
  amount: string;
  currency: string;
  label: string;
  occurredAt: string;
  categoryLabel: string | null;
  categoryKey: string | null;
  financeCategoryId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  attachmentUrl: string | null;
  note: string | null;
  /** manual | auto — dépenses plateforme (ex. RDV véto). */
  source?: string | null;
  isAutoGenerated?: boolean;
  linkedStockMovementIds?: string[];
  creator?: { id: string; fullName: string | null; email: string | null };
};

export type FinanceReportCategoryRow = {
  key: string;
  label: string;
  expenses: string;
  revenues: string;
  net: string;
};

export type FinanceReportDto = {
  farmId: string;
  period: "month" | "year";
  range: { start: string; end: string };
  currency: string;
  currencySymbol: string;
  totals: { expenses: string; revenues: string; net: string };
  byCategory: FinanceReportCategoryRow[];
  monthlyEvolution?: Array<{
    month: string;
    expenses: string;
    revenues: string;
    net: string;
  }>;
  topExpenseCategories?: Array<{
    key: string;
    label: string;
    expenses: string;
  }>;
};

export type FinanceProjectionDto = {
  farmId: string;
  currency: string;
  basedOnMonths: number;
  nextMonths: Array<{
    monthOffset: number;
    projectedExpenses: string;
    projectedRevenues: string;
    projectedNet: string;
  }>;
  deficitAlert: boolean;
};

export type FinanceMarginByBatchDto = {
  farmId: string;
  batchId: string;
  batchName: string;
  headcount: number;
  revenues: string;
  expensesAllocated: string;
  grossMargin: string;
  costPerHead: string;
  costPerKg: string | null;
};

export type FarmFinanceSettingsDto = {
  farmId: string;
  currencyCode: string;
  currencySymbol: string;
  lowBalanceThreshold: string | null;
};

export function fetchFinanceOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FinanceOverviewDto> {
  return apiGetJson<FinanceOverviewDto>(
    `/farms/${farmId}/finance/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFinanceSettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmFinanceSettingsDto> {
  return apiGetJson<FarmFinanceSettingsDto>(
    `/farms/${farmId}/finance/settings`,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmFinanceSettingsPayload = {
  currencyCode?: string;
  currencySymbol?: string;
  lowBalanceThreshold?: number | null;
};

export function patchFarmFinanceSettings(
  accessToken: string,
  farmId: string,
  payload: PatchFarmFinanceSettingsPayload,
  activeProfileId?: string | null
): Promise<FarmFinanceSettingsDto> {
  return apiPatchJson<FarmFinanceSettingsDto>(
    `/farms/${farmId}/finance/settings`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceCategories(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FinanceCategoryDto[]> {
  return apiGetJson<FinanceCategoryDto[]>(
    `/farms/${farmId}/finance/categories`,
    accessToken,
    activeProfileId
  );
}

export function createFinanceCategory(
  accessToken: string,
  farmId: string,
  payload: {
    type: "income" | "expense";
    key: string;
    name: string;
    icon?: string | null;
  },
  activeProfileId?: string | null
): Promise<FinanceCategoryDto> {
  return apiPostJson<FinanceCategoryDto>(
    `/farms/${farmId}/finance/categories`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteFinanceCategory(
  accessToken: string,
  farmId: string,
  categoryId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/categories/${categoryId}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceTransactions(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: {
    type?: "income" | "expense";
    financeCategoryId?: string;
    from?: string;
    to?: string;
  }
): Promise<FinanceMergedTransactionDto[]> {
  const qs = new URLSearchParams();
  if (filters?.type) qs.set("type", filters.type);
  if (filters?.financeCategoryId) {
    qs.set("financeCategoryId", filters.financeCategoryId);
  }
  if (filters?.from) qs.set("from", filters.from);
  if (filters?.to) qs.set("to", filters.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FinanceMergedTransactionDto[]>(
    `/farms/${farmId}/finance/transactions${suffix}`,
    accessToken,
    activeProfileId
  );
}

export type PostFinanceTransactionPayload = {
  type: "income" | "expense";
  financeCategoryId?: string;
  amount: number;
  currency?: string;
  label: string;
  occurredAt?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  attachmentUrl?: string;
  note?: string;
};

export function postFinanceTransaction(
  accessToken: string,
  farmId: string,
  payload: PostFinanceTransactionPayload,
  activeProfileId?: string | null
): Promise<FarmExpenseDto | FarmRevenueDto> {
  return apiPostJson<FarmExpenseDto | FarmRevenueDto>(
    `/farms/${farmId}/finance/transactions`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceReport(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period: "month" | "year" = "month",
  month?: string,
  year?: string
): Promise<FinanceReportDto> {
  const qs = new URLSearchParams();
  qs.set("period", period);
  if (month) qs.set("month", month);
  if (year) qs.set("year", year);
  return apiGetJson<FinanceReportDto>(
    `/farms/${farmId}/finance/report?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceProjection(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FinanceProjectionDto> {
  return apiGetJson<FinanceProjectionDto>(
    `/farms/${farmId}/finance/projection`,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceMarginByBatch(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<FinanceMarginByBatchDto> {
  return apiGetJson<FinanceMarginByBatchDto>(
    `/farms/${farmId}/finance/margin-by-batch?batchId=${encodeURIComponent(batchId)}`,
    accessToken,
    activeProfileId
  );
}

export type FarmBudgetLineDto = {
  budgetLineId: string | null;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  categoryIcon: string | null;
  amountPlanned: string;
  amountRealized: string;
  amountProjected: string;
  consumptionPct: number;
  projectedConsumptionPct: number;
  remaining: string;
  status: "ok" | "warning" | "exceeded";
  projectedStatus: "ok" | "warning" | "exceeded";
  currency: string;
};

export type FarmBudgetGlobalDto = {
  totalPlanned: string;
  totalRealized: string;
  totalProjected: string;
  remaining: string;
  consumptionPct: number;
  status: "on_track" | "warning" | "exceeded";
  deltaProjected: string;
  projectedEndOfMonth: string;
};

export type FarmBudgetSuggestionDto = {
  id: string;
  type: string;
  message: string;
  actionPayload: Record<string, unknown> | null;
  isApplied: boolean;
  isDismissed: boolean;
  createdAt: string;
};

export type FarmBudgetViewDto = {
  farmId: string;
  year: number;
  month: number;
  configured: boolean;
  budgetId: string | null;
  currency: string;
  currencySymbol: string;
  createdFrom: string | null;
  global: FarmBudgetGlobalDto;
  lines: FarmBudgetLineDto[];
  suggestions: FarmBudgetSuggestionDto[];
};

export type FarmBudgetCategoryHistoryDto = {
  categoryId: string;
  points: Array<{ year: number; month: number; expenses: string }>;
  averageExpenses: string;
};

export type FarmBudgetSimulateDto = {
  categoryId: string;
  newAmount: string;
  global: FarmBudgetGlobalDto & {
    previousTotalPlanned: string;
    marginAvailable: string;
  };
  lines: FarmBudgetLineDto[];
};

export function fetchFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiGetJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function upsertFarmBudget(
  accessToken: string,
  farmId: string,
  payload: {
    year: number;
    month: number;
    lines: Array<{ categoryId: string; amountPlanned: number }>;
    createdFrom?: "manual" | "copied" | "auto_suggested";
  },
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function copyPreviousFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget/copy-previous?${qs.toString()}`,
    {},
    accessToken,
    activeProfileId
  );
}

export function applyAutoFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget/suggestion-auto?${qs.toString()}`,
    {},
    accessToken,
    activeProfileId
  );
}

export function updateFarmBudgetLine(
  accessToken: string,
  farmId: string,
  lineId: string,
  amountPlanned: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  return apiPutJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget-lines/${lineId}`,
    { amountPlanned },
    accessToken,
    activeProfileId
  );
}

export function fetchFarmBudgetCategoryHistory(
  accessToken: string,
  farmId: string,
  categoryId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetCategoryHistoryDto> {
  const qs = new URLSearchParams();
  qs.set("categoryId", categoryId);
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiGetJson<FarmBudgetCategoryHistoryDto>(
    `/farms/${farmId}/finance/budget/category-history?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function simulateFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  categoryId: string,
  newAmount: number,
  activeProfileId?: string | null
): Promise<FarmBudgetSimulateDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  qs.set("categoryId", categoryId);
  qs.set("newAmount", String(newAmount));
  return apiGetJson<FarmBudgetSimulateDto>(
    `/farms/${farmId}/finance/budget/simulate?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export type BudgetAiRecommendation = {
  categoryId: string;
  categoryName: string;
  currentBudget: number;
  suggestedBudget: number;
  savings: number;
  action: string;
  justification: string;
};

export type BudgetAiAnalysisDto = {
  analysis: string;
  recommendations: BudgetAiRecommendation[];
  totalSavingsEstimate: number;
  aiPowered?: boolean;
};

export function fetchBudgetAiAnalysis(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<BudgetAiAnalysisDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiGetJson<BudgetAiAnalysisDto>(
    `/farms/${farmId}/finance/budget/ai-analysis?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function applyBudgetAiRecommendations(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  items: Array<{ categoryId: string; suggestedBudget: number }>,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget/ai-analysis/apply?${qs.toString()}`,
    { items },
    accessToken,
    activeProfileId
  );
}

export function patchFarmBudgetSuggestion(
  accessToken: string,
  farmId: string,
  suggestionId: string,
  payload: { apply?: boolean; dismiss?: boolean },
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  return apiPatchJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget-suggestions/${suggestionId}`,
    payload,
    accessToken,
    activeProfileId
  );
}
// ─── Finance + stock aliment ─────────────────────────────────────────────────

export type FinanceStockLineInput = {
  feedTypeId?: string;
  newFeedType?: { name: string; unit: "kg" | "sac" };
  quantityInput: number;
  quantityUnit: "kg" | "tonne" | "sac";
  unitPrice?: number;
  totalCost?: number;
  priceBasis?: "kg" | "sac";
  weightPerBagKg?: number;
  supplier?: string;
};

export type PostFinanceTransactionWithStockPayload = {
  amount: number;
  currency?: string;
  label: string;
  financeCategoryId?: string;
  occurredAt?: string;
  note?: string;
  attachmentUrl?: string;
  recordStock?: boolean;
  stockLines?: FinanceStockLineInput[];
};

/** POST /api/v1/farms/:farmId/finance/transactions/with-stock */
export function postFinanceTransactionWithStock(
  accessToken: string,
  farmId: string,
  payload: PostFinanceTransactionWithStockPayload,
  activeProfileId?: string | null
): Promise<FarmExpenseDto> {
  return apiPostJson<FarmExpenseDto>(
    `/farms/${farmId}/finance/transactions/with-stock`,
    payload,
    accessToken,
    activeProfileId
  );
}
