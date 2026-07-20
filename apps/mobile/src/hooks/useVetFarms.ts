import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../context/SessionContext";
import { fetchVetDashboard, type VetDashboardDto } from "../lib/api";

export type VetAssignedFarm = VetDashboardDto["assignedFarms"][number];

function storageKey(profileId: string): string {
  return `@fermier/vetSelectedFarm:${profileId}`;
}

/**
 * Élevages suivis par le vétérinaire + sélection persistée (AsyncStorage).
 * Remplace le pattern `farms[0]` / `primaryFarm` ad-hoc.
 */
export function useVetFarms(activeProfileId: string | null | undefined) {
  const { accessToken } = useSession();
  const [persistedId, setPersistedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  /** Même clé que VetDashboardScreen pour partager le cache TanStack. */
  const dashQ = useQuery({
    queryKey: ["vetDashboard", activeProfileId],
    queryFn: () => fetchVetDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && activeProfileId),
    staleTime: 30_000
  });

  const farms = dashQ.data?.assignedFarms ?? [];

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    if (!activeProfileId) {
      setPersistedId(null);
      setHydrated(true);
      return;
    }
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(activeProfileId));
        if (!cancelled) {
          setPersistedId(raw && raw.length > 0 ? raw : null);
        }
      } catch {
        if (!cancelled) setPersistedId(null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId]);

  const setSelectedFarmId = useCallback(
    (farmId: string | null) => {
      setPersistedId(farmId);
      if (!activeProfileId) return;
      void (async () => {
        try {
          if (farmId) {
            await AsyncStorage.setItem(storageKey(activeProfileId), farmId);
          } else {
            await AsyncStorage.removeItem(storageKey(activeProfileId));
          }
        } catch {
          /* ignore persistence errors */
        }
      })();
    },
    [activeProfileId]
  );

  /** Si l'id persisté n'est plus dans la liste, bascule sur le premier élevage dispo. */
  const selectedFarmId = useMemo(() => {
    if (!farms.length) return null;
    if (persistedId && farms.some((f) => f.id === persistedId)) {
      return persistedId;
    }
    return farms[0]?.id ?? null;
  }, [farms, persistedId]);

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) ?? null,
    [farms, selectedFarmId]
  );

  useEffect(() => {
    if (!hydrated || !farms.length || !activeProfileId) return;
    if (persistedId && farms.some((f) => f.id === persistedId)) return;
    const fallback = farms[0]?.id;
    if (fallback && fallback !== persistedId) {
      setSelectedFarmId(fallback);
    }
  }, [
    hydrated,
    farms,
    persistedId,
    activeProfileId,
    setSelectedFarmId
  ]);

  return {
    farms,
    selectedFarmId,
    selectedFarm,
    setSelectedFarmId,
    isLoading: dashQ.isLoading || !hydrated,
    isFetching: dashQ.isFetching,
    refetch: dashQ.refetch,
    error: dashQ.error
  };
}
