/** Clés React Query à invalider après une mutation budget (sync ou file). */
export const BUDGET_INVALIDATE_ROOTS = [
  "farmBudget",
  "financeOverview",
  "financeReport"
] as const;
