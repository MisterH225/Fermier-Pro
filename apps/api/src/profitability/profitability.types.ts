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

export type CostBreakdownItem = {
  key: string;
  label: string;
  amount: number;
  pct: number;
};

export type MonthlyRevCostPoint = {
  month: string;
  revenuesRealized: number;
  costsTotal: number;
  netMargin: number;
  revenuesProjected?: number;
  costsProjected?: number;
};

export type ProfitabilityMetrics = {
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

export type FarmProfitabilityResult = {
  farmId: string;
  period: ProfitabilityPeriodKey;
  periodStart: string;
  periodEnd: string;
  currency: string;
  marketPricePerKg: number | null;
  dataQuality: ProfitabilityDataQuality;
  dataQualityMessage: string | null;
  realized: ProfitabilityMetrics;
  projected: ProfitabilityMetrics;
  combined: ProfitabilityMetrics;
  costBreakdown: CostBreakdownItem[];
  monthlySeries: MonthlyRevCostPoint[];
  trendVsPreviousPeriod: {
    netMarginPctDelta: number | null;
    grossMarginPctDelta: number | null;
  };
  snapshotAt: string;
};

export type BatchProfitabilityResult = {
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
  realized: ProfitabilityMetrics & {
    icActual: number | null;
    gmqActual: number | null;
    durationDays: number | null;
    revenuePerAnimal: number | null;
  };
  projected: ProfitabilityMetrics & {
    remainingDaysEstimate: number | null;
    confidence: "high" | "medium" | "low" | null;
  };
  combined: ProfitabilityMetrics;
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
  realized: ProfitabilityMetrics;
  projected: ProfitabilityMetrics;
};

export type ProfitabilityInsight = {
  title: string;
  observation: string;
  recommendation: string;
  potentialImpact: string;
  priority: "high" | "medium" | "low";
};

export type ProfitabilityInsightsResult = {
  insights: ProfitabilityInsight[];
  generatedAt: string | null;
  available: boolean;
};
