import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserFacingError } from "../lib/userFacingError";
import { useTranslation } from "react-i18next";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { queryClient } from "../lib/queryClient";
import {
  fetchAllFarms,
  setActiveFarm as apiSetActiveFarm,
  archiveFarm as apiArchiveFarm,
  restoreFarm as apiRestoreFarm,
  deleteFarm as apiDeleteFarm,
  type FarmDto,
  type ArchiveFarmReason
} from "../lib/api";
import { useSession } from "./SessionContext";

const STORAGE_ACTIVE_FARM_KEY = "@fermier_pro/active_farm_id";

export type ActiveProjectContextValue = {
  activeFarm: FarmDto | null;
  activeFarmId: string | null;
  farms: FarmDto[];
  activeFarmsCount: number;
  archivedFarmsCount: number;
  isLoading: boolean;
  error: string | null;
  canCreateNewProject: boolean;
  setActiveFarm: (farmId: string) => Promise<void>;
  archiveFarm: (farmId: string, reason?: ArchiveFarmReason) => Promise<void>;
  restoreFarm: (farmId: string) => Promise<void>;
  deleteFarm: (farmId: string) => Promise<void>;
  refreshFarms: () => Promise<void>;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

const MAX_ACTIVE_FARMS = 3;

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [farms, setFarms] = useState<FarmDto[]>([]);
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFarm = useMemo(
    () => farms.find((f) => f.id === activeFarmId && f.status === "active") ?? null,
    [farms, activeFarmId]
  );

  const activeFarmsCount = useMemo(
    () => farms.filter((f) => f.status === "active").length,
    [farms]
  );

  const archivedFarmsCount = useMemo(
    () => farms.filter((f) => f.status === "archived").length,
    [farms]
  );

  const canCreateNewProject = activeFarmsCount < MAX_ACTIVE_FARMS;

  const loadFarms = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllFarms(accessToken, activeProfileId);
      setFarms(data);

      const storedId = await AsyncStorage.getItem(STORAGE_ACTIVE_FARM_KEY);
      const serverActiveId = authMe?.activeFarm?.id;

      let resolvedActiveId: string | null = null;

      if (serverActiveId && data.some((f) => f.id === serverActiveId && f.status === "active")) {
        resolvedActiveId = serverActiveId;
      } else if (storedId && data.some((f) => f.id === storedId && f.status === "active")) {
        resolvedActiveId = storedId;
      } else {
        const firstActive = data.find((f) => f.status === "active");
        resolvedActiveId = firstActive?.id ?? null;
      }

      setActiveFarmIdState(resolvedActiveId);
      if (resolvedActiveId) {
        await AsyncStorage.setItem(STORAGE_ACTIVE_FARM_KEY, resolvedActiveId);
      }
    } catch (e) {
      setError(getUserFacingError(e, t));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, activeProfileId, authMe?.activeFarm?.id]);

  useEffect(() => {
    void loadFarms();
  }, [loadFarms]);

  const refreshFarms = useCallback(async () => {
    await loadFarms();
  }, [loadFarms]);

  const setActiveFarm = useCallback(
    async (farmId: string) => {
      if (!accessToken) return;
      setError(null);
      try {
        await apiSetActiveFarm(accessToken, farmId, activeProfileId);
        setActiveFarmIdState(farmId);
        await AsyncStorage.setItem(STORAGE_ACTIVE_FARM_KEY, farmId);

        queryClient.removeQueries();
        await refreshAuthMe();
      } catch (e) {
        setError(getUserFacingError(e, t));
        throw e;
      }
    },
    [accessToken, activeProfileId, refreshAuthMe]
  );

  const archiveFarm = useCallback(
    async (farmId: string, reason?: ArchiveFarmReason) => {
      if (!accessToken) return;
      setError(null);
      try {
        const updated = await apiArchiveFarm(accessToken, farmId, reason, activeProfileId);
        setFarms((prev) => prev.map((f) => (f.id === farmId ? updated : f)));

        if (activeFarmId === farmId) {
          const nextActive = farms.find(
            (f) => f.id !== farmId && f.status === "active"
          );
          if (nextActive) {
            await setActiveFarm(nextActive.id);
          } else {
            setActiveFarmIdState(null);
            await AsyncStorage.removeItem(STORAGE_ACTIVE_FARM_KEY);
          }
        }

        await refreshAuthMe();
      } catch (e) {
        setError(getUserFacingError(e, t));
        throw e;
      }
    },
    [accessToken, activeProfileId, activeFarmId, farms, setActiveFarm, refreshAuthMe]
  );

  const restoreFarm = useCallback(
    async (farmId: string) => {
      if (!accessToken) return;
      setError(null);
      try {
        const updated = await apiRestoreFarm(accessToken, farmId, activeProfileId);
        setFarms((prev) => prev.map((f) => (f.id === farmId ? updated : f)));
        await refreshAuthMe();
      } catch (e) {
        setError(getUserFacingError(e, t));
        throw e;
      }
    },
    [accessToken, activeProfileId, refreshAuthMe]
  );

  const deleteFarm = useCallback(
    async (farmId: string) => {
      if (!accessToken) return;
      setError(null);
      try {
        await apiDeleteFarm(accessToken, farmId, activeProfileId);
        setFarms((prev) => prev.filter((f) => f.id !== farmId));

        if (activeFarmId === farmId) {
          const nextActive = farms.find(
            (f) => f.id !== farmId && f.status === "active"
          );
          if (nextActive) {
            await setActiveFarm(nextActive.id);
          } else {
            setActiveFarmIdState(null);
            await AsyncStorage.removeItem(STORAGE_ACTIVE_FARM_KEY);
          }
        }

        await refreshAuthMe();
      } catch (e) {
        setError(getUserFacingError(e, t));
        throw e;
      }
    },
    [accessToken, activeProfileId, activeFarmId, farms, setActiveFarm, refreshAuthMe]
  );

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      activeFarm,
      activeFarmId,
      farms,
      activeFarmsCount,
      archivedFarmsCount,
      isLoading,
      error,
      canCreateNewProject,
      setActiveFarm,
      archiveFarm,
      restoreFarm,
      deleteFarm,
      refreshFarms
    }),
    [
      activeFarm,
      activeFarmId,
      farms,
      activeFarmsCount,
      archivedFarmsCount,
      isLoading,
      error,
      canCreateNewProject,
      setActiveFarm,
      archiveFarm,
      restoreFarm,
      deleteFarm,
      refreshFarms
    ]
  );

  return (
    <ActiveProjectContext.Provider value={value}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) {
    throw new Error("useActiveProject must be used within ActiveProjectProvider");
  }
  return ctx;
}

export function useActiveFarm() {
  const { activeFarm, activeFarmId, isLoading } = useActiveProject();
  return { activeFarm, activeFarmId, isLoading };
}
