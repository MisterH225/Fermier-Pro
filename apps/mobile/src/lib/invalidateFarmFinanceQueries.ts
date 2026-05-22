import type { QueryClient } from "@tanstack/react-query";
import { invalidateAIInsights } from "../services/ai/AIRecommendationService";

/** Invalide les caches React Query liés aux écrans finance (overview, budget, rapport…). */
export function invalidateFarmFinanceQueries(
  qc: QueryClient,
  farmId: string
): void {
  void invalidateAIInsights(farmId, "finance");
  void invalidateAIInsights(farmId, "global_dashboard");
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
