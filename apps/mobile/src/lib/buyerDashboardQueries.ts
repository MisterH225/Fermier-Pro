import type { QueryClient } from "@tanstack/react-query";

/** Invalide les requêtes liées au tableau de bord acheteur après une action marketplace. */
export function invalidateBuyerDashboardQueries(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
  void qc.invalidateQueries({ queryKey: ["buyerProposals"] });
  void qc.invalidateQueries({ queryKey: ["buyerPurchases"] });
}
