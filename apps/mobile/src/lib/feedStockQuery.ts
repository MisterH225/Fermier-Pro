import type { QueryClient } from "@tanstack/react-query";

/** Requêtes stock : pas de cache long pour refléter les mouvements récents. */
export const feedStockLiveQueryOptions = {
  staleTime: 0,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true
};

export function farmFeedQueryKey(farmId: string, activeProfileId?: string | null) {
  return ["farmFeed", farmId, activeProfileId ?? null] as const;
}

/** Invalide et refetch immédiat chart + stats + overview après un mouvement. */
export async function refreshFarmFeedQueries(
  qc: QueryClient,
  farmId: string,
  activeProfileId?: string | null
): Promise<void> {
  await qc.invalidateQueries({ queryKey: farmFeedQueryKey(farmId, activeProfileId) });
  await qc.refetchQueries({
    queryKey: farmFeedQueryKey(farmId, activeProfileId),
    type: "active"
  });
  await qc.invalidateQueries({ queryKey: ["dashboardFeedStock", farmId] });
  await qc.refetchQueries({
    queryKey: ["dashboardFeedStock", farmId],
    type: "active"
  });
}
