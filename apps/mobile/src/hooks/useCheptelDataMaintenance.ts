import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { maintainCheptelData } from "../lib/api";

/** Incrémenter si la logique de maintenance côté API évolue. */
const CHEPTEL_MAINTENANCE_VERSION = 1;

const maintainedFarmKeys = new Set<string>();

type Params = {
  farmId: string;
  accessToken: string | null | undefined;
  activeProfileId?: string | null;
  readOnly?: boolean;
};

/**
 * Lance POST /cheptel/maintain-data une fois par ferme et par session
 * avant le chargement des loges (onglet Cheptel).
 */
export function useCheptelDataMaintenance({
  farmId,
  accessToken,
  activeProfileId,
  readOnly = false
}: Params): { pensLoadEnabled: boolean } {
  const qc = useQueryClient();
  const maintenanceKey = `${farmId}:v${CHEPTEL_MAINTENANCE_VERSION}`;
  const [pensLoadEnabled, setPensLoadEnabled] = useState(
    () => readOnly || maintainedFarmKeys.has(maintenanceKey)
  );

  useEffect(() => {
    if (readOnly) {
      setPensLoadEnabled(true);
      return;
    }
    if (!accessToken || !farmId) {
      return;
    }
    if (maintainedFarmKeys.has(maintenanceKey)) {
      setPensLoadEnabled(true);
      return;
    }

    let cancelled = false;
    maintainedFarmKeys.add(maintenanceKey);

    void maintainCheptelData(accessToken, farmId, activeProfileId)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
        void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
        void qc.invalidateQueries({ queryKey: ["penContents", farmId] });
      })
      .catch(() => {
        maintainedFarmKeys.delete(maintenanceKey);
      })
      .finally(() => {
        if (!cancelled) {
          setPensLoadEnabled(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    farmId,
    maintenanceKey,
    activeProfileId,
    readOnly,
    qc
  ]);

  return { pensLoadEnabled };
}
