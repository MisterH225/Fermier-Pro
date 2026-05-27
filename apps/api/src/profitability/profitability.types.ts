export type ProductionPhaseKey = "starter" | "growth" | "fattening";

export type FeedCostByPhase = {
  starter: number;
  growth: number;
  fattening: number;
  breeder: number;
};

export type IcPhaseResult = {
  phase: ProductionPhaseKey;
  label: string;
  icCalculated: number | null;
  icTarget: number;
  status: "ok" | "warning" | "critical" | "unavailable";
  feedConsumedKg: number;
  kgGained: number;
  kgGainedLabel: string;
  dataSource: "real" | "estimated";
};

export type IcByPhasePayload = {
  starter: IcPhaseResult;
  growth: IcPhaseResult;
  fattening: IcPhaseResult;
  global: {
    icCalculated: number | null;
    feedConsumedKg: number;
    kgGained: number;
    note: string;
  };
  allFeedTypesQualified: boolean;
};

export type CostBreakdownRow = {
  key: string;
  label: string;
  amount: number;
  pctOfTotal: number;
  costPerKg: number | null;
  color: string;
};

export type ProfitabilityPeriodResult = {
  farmId: string;
  periodMonth: number;
  periodYear: number;
  currency: string;
  currencySymbol: string;
  settings: {
    marketPricePerKg: number | null;
    icTargetStarter: number;
    icTargetGrowth: number;
    icTargetFattening: number;
    gmqRefStarter: number;
    gmqRefGrowth: number;
    gmqRefFattening: number;
  };
  totalCosts: number;
  feedCostByPhase: FeedCostByPhase;
  healthCost: number;
  fixedCosts: number;
  breederCostImputed: number;
  otherCosts: number;
  kgSoldReal: number;
  kgSoldLabel: string;
  kgEstimatedInStock: number;
  kgEstimatedLabel: string;
  avgSalePricePerKg: number | null;
  costPerKgSold: number | null;
  costPerKgProduced: number | null;
  marginPerKg: number | null;
  breakEvenPricePerKg: number | null;
  isProfitable: boolean | null;
  herdValueEstimated: number | null;
  icByPhase: IcByPhasePayload;
  costBreakdown: CostBreakdownRow[];
  calculatedAt: string;
  snapshotId: string | null;
};
