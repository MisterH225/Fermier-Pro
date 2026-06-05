import type { QueryClient } from "@tanstack/react-query";
import { invalidateAIInsights } from "../../services/ai/AIRecommendationService";
import {
  BUDGET_INVALIDATE_ROOTS,
  FINANCE_INVALIDATE_ROOTS
} from "./financeQueryKeys";

function invalidateRoots(
  qc: QueryClient,
  farmId: string,
  roots: readonly string[]
): void {
  for (const key of roots) {
    void qc.invalidateQueries({ queryKey: [key, farmId] });
  }
}

/** Invalide les caches React Query liés aux écrans finance (overview, budget, rapport…). */
export function invalidateFarmFinanceQueries(
  qc: QueryClient,
  farmId: string
): void {
  void invalidateAIInsights(farmId, "finance");
  void invalidateAIInsights(farmId, "global_dashboard");
  invalidateRoots(qc, farmId, FINANCE_INVALIDATE_ROOTS);
}

/** Invalide les caches budget après mutation (setup, ligne, simulation). */
export function invalidateBudgetQueries(
  qc: QueryClient,
  farmId: string
): void {
  invalidateRoots(qc, farmId, BUDGET_INVALIDATE_ROOTS);
}
