import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AddWeightModal } from "../cheptel/weight/AddWeightModal";
import { StockModal } from "../feed/StockModal";
import { DiseaseModal } from "../shared/DiseaseModal";
import {
  fetchFarm,
  fetchFarmAnimals,
  fetchFarmBatches,
  fetchFarmFeedTypes
} from "../../lib/api";
import type { TechQuickActionKey } from "../../lib/technicianPermissions";

type ActiveFarm = {
  farmId: string;
  farmName: string;
  scopes: string[];
};

type Props = {
  farm: ActiveFarm | undefined;
  accessToken: string;
  activeProfileId?: string | null;
  openAction: TechQuickActionKey | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function TechQuickActionModals({
  farm,
  accessToken,
  activeProfileId,
  openAction,
  onClose,
  onSuccess
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const farmId = farm?.farmId ?? "";

  const feedTypesQ = useQuery({
    queryKey: ["farmFeedTypes", farmId, activeProfileId, "techQuick"],
    queryFn: () => fetchFarmFeedTypes(accessToken, farmId, activeProfileId),
    enabled: Boolean(
      farmId &&
        accessToken &&
        (openAction === "stock" || openAction === "feedIn")
    )
  });

  const farmQ = useQuery({
    queryKey: ["farm", farmId, "techQuick"],
    queryFn: () => fetchFarm(accessToken, farmId, activeProfileId),
    enabled: Boolean(farmId && accessToken && openAction === "disease")
  });

  const animalsQ = useQuery({
    queryKey: ["farmAnimals", farmId, "techQuick"],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: Boolean(farmId && accessToken && openAction === "disease")
  });

  const batchesQ = useQuery({
    queryKey: ["farmBatches", farmId, "techQuick"],
    queryFn: () => fetchFarmBatches(accessToken, farmId, activeProfileId),
    enabled: Boolean(farmId && accessToken && openAction === "disease")
  });

  const invalidate = () => {
    if (!farmId) return;
    void qc.invalidateQueries({ queryKey: ["techDashboard"] });
    void qc.invalidateQueries({ queryKey: ["techActivity"] });
    void qc.invalidateQueries({ queryKey: ["farmFeedStock", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmHealthEvents", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
    onSuccess();
  };

  if (!farm) {
    return null;
  }

  const livestockMode =
    (farmQ.data?.livestockMode as "individual" | "batch" | "hybrid") ||
    "individual";

  return (
    <>
      <StockModal
        visible={openAction === "stock"}
        onClose={onClose}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        types={feedTypesQ.data ?? []}
        defaultTab="stock_check"
        onSuccess={() => {
          invalidate();
          onClose();
        }}
      />
      <StockModal
        visible={openAction === "feedIn"}
        onClose={onClose}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        types={feedTypesQ.data ?? []}
        defaultTab="in"
        onSuccess={() => {
          invalidate();
          onClose();
        }}
      />
      <AddWeightModal
        visible={openAction === "weight"}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={onClose}
        onSaved={() => {
          invalidate();
          onClose();
        }}
      />
      <DiseaseModal
        visible={openAction === "disease"}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        livestockMode={livestockMode}
        animals={animalsQ.data ?? []}
        batches={(batchesQ.data ?? []).filter((b) => b.status === "active")}
        onClose={onClose}
        onSuccess={() => {
          invalidate();
          onClose();
        }}
      />
    </>
  );
}
