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
};
