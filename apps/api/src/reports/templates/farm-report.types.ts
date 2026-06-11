import type { ScoreBreakdown } from "../reports-score.util";

export type ReportRecommendation = {
  icon: string;
  title: string;
  description: string;
  priority: "URGENT" | "IMPORTANT" | "CONSEIL";
};

export type ReportMarketplaceSection = {
  salesCount: number;
  totalFcfa: number;
  avgPricePerKg: number | null;
  pigPriceIndexDeltaPct: number | null;
  salesByCategory: { label: string; count: number; amount: number }[];
  topSales: { animal: string; weightKg: number | null; price: number; date: string }[];
  unsoldListingsCount: number;
  unsoldEstimatedValue: number;
  pendingEscrowCount: number;
  pendingEscrowAmount: number;
  pendingDeliveryCount: number;
};

export type ReportBankScoring = {
  riskLevel: "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ";
  risqueSanitaire: number;
  risqueFinancier: number;
  risqueOperationnel: number;
  avgMonthlyRevenue: number;
  herdGrowthPct: number | null;
};

export type ReportCheptelCategories = {
  total: number;
  breedingFemales: number;
  piglets: number;
  fattening: number;
  breedingMales: number;
  headcountDeltaPct: number | null;
};

export type ReportGestationExtended = {
  activeGestations: number;
  expectedFarrowingsThisMonth: number;
  avgLitterSize: number | null;
  upcomingFarrowings: { label: string; date: string }[];
};

export type ReportFeedExtended = {
  stockDaysRemaining: number | null;
  stockAlertLevel: "green" | "amber" | "red";
  costPerKgProduced: number | null;
  fcr: number | null;
  adg: number | null;
};

export type ReportProfitabilitySection = {
  available: boolean;
  dataQuality: string;
  currency: string;
  marketPricePerKg: number | null;
  realized: {
    grossMargin: number | null;
    grossMarginPct: number | null;
    netMargin: number | null;
    netMarginPct: number | null;
    costPerKg: number | null;
    roi: number | null;
    breakevenPricePerKg: number | null;
    revenues: number | null;
    costsTotal: number | null;
  };
  trendNetMarginPctDelta: number | null;
  trendGrossMarginPctDelta: number | null;
  costBreakdown: { label: string; amount: number; pct: number }[];
  monthlySeries: { month: string; revenues: number; costs: number; netMargin: number }[];
  topBatches: {
    name: string;
    netMarginPct: number | null;
    icActual: number | null;
    gmqActual: number | null;
  }[];
};

export type ReportPredictionsSection = {
  available: boolean;
  generatedAt: string | null;
  insufficientData: boolean;
  insufficientMessage: string | null;
  financeForecast: {
    horizon30: {
      revenue: number;
      expenses: number;
      margin: number;
      marginPct: number;
    } | null;
    horizon60: {
      revenue: number;
      expenses: number;
      margin: number;
      marginPct: number;
    } | null;
    horizon90: {
      revenue: number;
      expenses: number;
      margin: number;
      marginPct: number;
    } | null;
    cashFlowAlert: { hasAlert: boolean; message: string | null };
  };
  saleTiming: {
    priceTrend: string;
    explanation: string;
    optimalWindow: string;
    expectedPricePerKg: number;
  } | null;
  alerts: { priority: string; message: string; action: string }[];
  herdEvolution: {
    current: number;
    projected30: number;
    projected60: number;
    projected90: number;
    growthRate: number;
  } | null;
  animalsReady30: number | null;
  upcomingBirths: { label: string; date: string; piglets: number }[];
};

export type FarmReportPdfContext = {
  farmName: string;
  ownerName: string;
  address: string | null;
  reportId: string;
  reportRef: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  contentHash: string | null;
  scoreGlobal: number;
  scoreBand: string;
  scoreBreakdown: ScoreBreakdown;
  scoreTrendDelta: number | null;
  currency: string;
  sections: Record<string, unknown>;
  marketplace: ReportMarketplaceSection;
  recommendations: ReportRecommendation[];
  objectives: string[];
  bankScoring: ReportBankScoring;
  cheptelCategories: ReportCheptelCategories;
  gestationExtended: ReportGestationExtended;
  feedExtended: ReportFeedExtended;
  profitability: ReportProfitabilitySection;
  predictions: ReportPredictionsSection;
  qrCodeDataUrl: string | null;
};

export type StoredReportSnapshot = {
  period?: { start: string; end: string };
  score?: {
    global: number;
    band: string;
    breakdown: ScoreBreakdown;
  };
  sections?: Record<string, unknown>;
  marketplace?: ReportMarketplaceSection;
  recommendations?: ReportRecommendation[];
  objectives?: string[];
  bankScoring?: ReportBankScoring;
  cheptelCategories?: ReportCheptelCategories;
  gestationExtended?: ReportGestationExtended;
  feedExtended?: ReportFeedExtended;
  profitability?: ReportProfitabilitySection;
  predictions?: ReportPredictionsSection;
};
