import type { QueryClient } from "@tanstack/react-query";

/** Invalide les caches React Query liés aux écrans finance (overview, budget, rapport…). */
export function invalidateFarmFinanceQueries(
  qc: QueryClient,
  farmId: string
): void {
  const prefixes = [
    "financeOverview",
    "financeTransactions",
    "financeReport",
    "financeProjection",
    "financeMargin",
    "financeCategories",
    "farmBudget",
    "financeSummary",
    "farmExpenses"
  ] as const;
  for (const key of prefixes) {
    void qc.invalidateQueries({ queryKey: [key, farmId] });
  }
}
