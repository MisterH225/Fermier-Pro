import { apiGetJson, apiPostJson } from "./http";

export type ProfitabilityPeriodKey =
  | "current_month"
  | "current_quarter"
  | "current_year"
  | "all_time"
  | "custom";

export type ProfitabilityViewMode = "realized" | "projected" | "combined";

export type ProfitabilityDataQuality =
  | "sufficient"
  | "partial"
  | "insufficient";

export type ProfitabilityMetricsDto = {
  grossMargin: number | null;
  grossMarginPct: number | null;
  netMargin: number | null;
  netMarginPct: number | null;
  costPerKg: number | null;
  roi: number | null;
  breakevenPricePerKg: number | null;
  revenues: number | null;
  costsDirect: number | null;
  costsIndirect: number | null;
  costsTotal: number | null;
  kgProduced: number | null;
};

export type FarmProfitabilityDto = {
  farmId: string;
  period: ProfitabilityPeriodKey;
  periodStart: string;
  periodEnd: string;
  currency: string;
  marketPricePerKg: number | null;
  dataQuality: ProfitabilityDataQuality;
  dataQualityMessage: string | null;
  realized: ProfitabilityMetricsDto;
  projected: ProfitabilityMetricsDto;
  combined: ProfitabilityMetricsDto;
  costBreakdown: Array<{
    key: string;
    label: string;
    amount: number;
    pct: number;
  }>;
  monthlySeries: Array<{
    month: string;
    revenuesRealized: number;
    costsTotal: number;
    netMargin: number;
  }>;
  trendVsPreviousPeriod: {
    netMarginPctDelta: number | null;
    grossMarginPctDelta: number | null;
  };
  snapshotAt: string;
};

export type BatchProfitabilityDto = {
  batchId: string;
  batchName: string;
  categoryKey: string | null;
  status: "open" | "closed";
  headcount: number;
  animalsSold: number;
  animalsRemaining: number;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  dataQuality: ProfitabilityDataQuality;
  dataQualityMessage: string | null;
  realized: ProfitabilityMetricsDto & {
    icActual: number | null;
    gmqActual: number | null;
    durationDays: number | null;
    revenuePerAnimal: number | null;
  };
  projected: ProfitabilityMetricsDto & {
    remainingDaysEstimate: number | null;
    confidence: "high" | "medium" | "low" | null;
  };
  combined: ProfitabilityMetricsDto;
  vsTargets: Array<{
    metric: string;
    actual: number | null;
    target: number | null;
    delta: number | null;
  }>;
  warnings: string[];
  snapshotAt: string;
};

export type FarmProfitabilityDashboardDto = {
  period: ProfitabilityPeriodKey;
  currency: string;
  marketPricePerKg: number | null;
  dataQuality: ProfitabilityDataQuality;
  dataQualityMessage: string | null;
  netMargin: number | null;
  netMarginPct: number | null;
  grossMargin: number | null;
  grossMarginPct: number | null;
  costPerKg: number | null;
  breakevenPricePerKg: number | null;
  trendNetMarginPctDelta: number | null;
  isProfitable: boolean | null;
  activeBatchesCount: number;
  bestBatch: { id: string; name: string; netMarginPct: number | null } | null;
  worstBatch: { id: string; name: string; netMarginPct: number | null } | null;
  realized: ProfitabilityMetricsDto;
  projected: ProfitabilityMetricsDto;
  historicalPeriod: {
    income: number;
    expense: number;
    netResult: number;
    recordsCount: number;
  };
  lifetime: ProfitabilityMetricsDto;
};

export type ProfitabilityInsightDto = {
  title: string;
  observation: string;
  recommendation: string;
  potentialImpact: string;
  priority: "high" | "medium" | "low";
};

export function fetchFarmProfitabilityDashboard(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period: ProfitabilityPeriodKey = "current_month"
): Promise<FarmProfitabilityDashboardDto> {
  return apiGetJson<FarmProfitabilityDashboardDto>(
    `/farms/${farmId}/profitability/dashboard?period=${period}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmProfitability(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period: ProfitabilityPeriodKey = "current_month"
): Promise<FarmProfitabilityDto> {
  return apiGetJson<FarmProfitabilityDto>(
    `/farms/${farmId}/profitability?period=${period}`,
    accessToken,
    activeProfileId
  );
}

export function fetchBatchProfitabilityList(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<BatchProfitabilityDto[]> {
  return apiGetJson<BatchProfitabilityDto[]>(
    `/farms/${farmId}/profitability/batches`,
    accessToken,
    activeProfileId
  );
}

export function fetchBatchProfitability(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<BatchProfitabilityDto> {
  return apiGetJson<BatchProfitabilityDto>(
    `/farms/${farmId}/profitability/batches/${batchId}`,
    accessToken,
    activeProfileId
  );
}

export function fetchProfitabilityInsights(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period: ProfitabilityPeriodKey = "current_month"
): Promise<{
  insights: ProfitabilityInsightDto[];
  generatedAt: string | null;
  available: boolean;
}> {
  return apiGetJson(
    `/farms/${farmId}/profitability/insights?period=${period}`,
    accessToken,
    activeProfileId
  );
}

export function postProfitabilityRecalculate(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  return apiPostJson<{ ok: true }>(
    `/farms/${farmId}/profitability/recalculate`,
    {},
    accessToken,
    activeProfileId
  );
}
