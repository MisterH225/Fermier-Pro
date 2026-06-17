import type { QueryClient } from "@tanstack/react-query";

/** Requêtes stock : pas de cache long pour refléter les mouvements récents. */
export const feedStockLiveQueryOptions = {
  staleTime: 0,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true
};

export function farmFeedQueryKey(farmId: string) {
  return ["farmFeed", farmId] as const;
}

/** Invalide et refetch immédiat chart + stats + overview après un mouvement. */
export async function refreshFarmFeedQueries(
  qc: QueryClient,
  farmId: string,
  _activeProfileId?: string | null
): Promise<void> {
  const rootKey = farmFeedQueryKey(farmId);
  await qc.invalidateQueries({ queryKey: rootKey });
  await qc.refetchQueries({
    queryKey: rootKey,
    type: "active"
  });
  await qc.invalidateQueries({ queryKey: ["dashboardFeedStock", farmId] });
  await qc.refetchQueries({
    queryKey: ["dashboardFeedStock", farmId],
    type: "active"
  });
}
