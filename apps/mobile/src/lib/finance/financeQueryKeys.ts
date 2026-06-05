/** Racines React Query du domaine finance — source unique pour invalidation et persistance. */
export const FINANCE_QUERY_ROOTS = {
  overview: "financeOverview",
  transactions: "financeTransactions",
  report: "financeReport",
  projection: "financeProjection",
  margin: "financeMargin",
  categories: "financeCategories",
  budget: "farmBudget",
  summary: "financeSummary",
  expenses: "farmExpenses",
  batches: "financeBatches",
  budgetCatHist: "budgetCatHist",
  linkedStock: "linkedStock"
} as const;

export type FinanceQueryRoot =
  (typeof FINANCE_QUERY_ROOTS)[keyof typeof FINANCE_QUERY_ROOTS];

/** Clés invalidées après toute mutation finance (transactions, dépenses, revenus…). */
export const FINANCE_INVALIDATE_ROOTS = [
  FINANCE_QUERY_ROOTS.overview,
  FINANCE_QUERY_ROOTS.transactions,
  FINANCE_QUERY_ROOTS.report,
  FINANCE_QUERY_ROOTS.projection,
  FINANCE_QUERY_ROOTS.margin,
  FINANCE_QUERY_ROOTS.categories,
  FINANCE_QUERY_ROOTS.budget,
  FINANCE_QUERY_ROOTS.summary,
  FINANCE_QUERY_ROOTS.expenses,
  FINANCE_QUERY_ROOTS.batches
] as const;

/** Sous-ensemble invalidé après une mutation budget (file offline ou sync directe). */
export const BUDGET_INVALIDATE_ROOTS = [
  FINANCE_QUERY_ROOTS.budget,
  FINANCE_QUERY_ROOTS.overview,
  FINANCE_QUERY_ROOTS.report
] as const;

/** Racines finance conservées en cache persistant (offline). */
export const FINANCE_PERSIST_QUERY_ROOTS = [
  FINANCE_QUERY_ROOTS.overview,
  FINANCE_QUERY_ROOTS.transactions,
  FINANCE_QUERY_ROOTS.categories,
  FINANCE_QUERY_ROOTS.report,
  FINANCE_QUERY_ROOTS.projection,
  FINANCE_QUERY_ROOTS.batches,
  FINANCE_QUERY_ROOTS.budget
] as const;

export const financeQueryKeys = {
  overview: (farmId: string, profileId?: string | null) =>
    [FINANCE_QUERY_ROOTS.overview, farmId, profileId] as const,
  transactions: (farmId: string, profileId?: string | null) =>
    [FINANCE_QUERY_ROOTS.transactions, farmId, profileId] as const,
  report: (farmId: string, profileId?: string | null) =>
    [FINANCE_QUERY_ROOTS.report, farmId, profileId] as const,
  projection: (farmId: string, profileId?: string | null) =>
    [FINANCE_QUERY_ROOTS.projection, farmId, profileId] as const,
  margin: (farmId: string, profileId?: string | null) =>
    [FINANCE_QUERY_ROOTS.margin, farmId, profileId] as const,
  categories: (farmId: string, profileId?: string | null) =>
    [FINANCE_QUERY_ROOTS.categories, farmId, profileId] as const,
  budget: (
    farmId: string,
    year: number,
    month: number,
    profileId?: string | null
  ) =>
    [FINANCE_QUERY_ROOTS.budget, farmId, year, month, profileId] as const,
  batches: (farmId: string, profileId?: string | null) =>
    [FINANCE_QUERY_ROOTS.batches, farmId, profileId] as const,
  budgetCatHist: (
    farmId: string,
    categoryId: string,
    year: number,
    month: number
  ) =>
    [FINANCE_QUERY_ROOTS.budgetCatHist, farmId, categoryId, year, month] as const,
  linkedStock: (farmId: string, transactionId: string) =>
    [FINANCE_QUERY_ROOTS.linkedStock, farmId, transactionId] as const
};
