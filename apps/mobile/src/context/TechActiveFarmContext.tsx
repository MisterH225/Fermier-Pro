import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

type TechActiveFarmContextValue = {
  /** Sélection locale (null = laisser l’API / première ferme décider). */
  activeFarmId: string | null;
  setActiveFarmId: (farmId: string | null) => void;
};

const TechActiveFarmContext = createContext<TechActiveFarmContextValue | null>(
  null
);

/**
 * Ferme active partagée entre Accueil / Tâches / modules tech.
 * Remis à zéro au changement de profil (provider sous `key={activeProfileId}`).
 */
export function TechActiveFarmProvider({ children }: { children: ReactNode }) {
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(null);
  const setActiveFarmId = useCallback((farmId: string | null) => {
    setActiveFarmIdState(farmId);
  }, []);

  const value = useMemo(
    () => ({ activeFarmId, setActiveFarmId }),
    [activeFarmId, setActiveFarmId]
  );

  return (
    <TechActiveFarmContext.Provider value={value}>
      {children}
    </TechActiveFarmContext.Provider>
  );
}

export function useTechActiveFarm(): TechActiveFarmContextValue {
  const ctx = useContext(TechActiveFarmContext);
  if (!ctx) {
    throw new Error("useTechActiveFarm must be used within TechActiveFarmProvider");
  }
  return ctx;
}

export type TechFarmListItem = {
  farmId: string;
  farmName: string;
  speciesFocus?: string | null;
  role?: string;
  scopes: string[];
};

/** Résout la ferme active : sélection locale → activeFarmId API → première ferme. */
export function resolveTechActiveFarm(
  farms: TechFarmListItem[],
  selectedFarmId: string | null,
  apiActiveFarmId?: string | null
): TechFarmListItem | null {
  if (!farms.length) {
    return null;
  }
  const id = selectedFarmId ?? apiActiveFarmId ?? farms[0]?.farmId ?? null;
  if (!id) {
    return null;
  }
  return farms.find((f) => f.farmId === id) ?? farms[0] ?? null;
}
