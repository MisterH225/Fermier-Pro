import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AddWeightModal } from "../cheptel/weight/AddWeightModal";
import { StockModal } from "../feed/StockModal";
import { BaseModal } from "../modals/BaseModal";
import { BulkVaccineModal } from "../sante/BulkVaccineModal";
import { DiseaseModal } from "../shared/DiseaseModal";
import {
  fetchFarm,
  fetchFarmAnimals,
  fetchFarmBatches,
  fetchFarmFeedTypes,
  fetchFarmVaccineCoverage,
  fetchFarmVaccineSubjects,
  type VaccineCatalogItemDto,
  type VaccineSubjectRowDto
} from "../../lib/api";
import type { TechQuickActionKey } from "../../lib/technicianPermissions";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors } from "../../theme/technicianTheme";

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

  const [vaccinePickerOpen, setVaccinePickerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkVaccine, setBulkVaccine] = useState<VaccineCatalogItemDto | null>(null);
  const [bulkSubjects, setBulkSubjects] = useState<VaccineSubjectRowDto[]>([]);
  const [loadingVaccineId, setLoadingVaccineId] = useState<string | null>(null);

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
    enabled: Boolean(
      farmId &&
        accessToken &&
        (openAction === "disease" || openAction === "vaccine")
    )
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

  const coverageQ = useQuery({
    queryKey: ["farmVaccineCoverage", farmId, activeProfileId, "techQuick"],
    queryFn: () => fetchFarmVaccineCoverage(accessToken, farmId, activeProfileId),
    enabled: Boolean(farmId && accessToken && openAction === "vaccine")
  });

  useEffect(() => {
    if (openAction === "vaccine") {
      setVaccinePickerOpen(true);
      setBulkOpen(false);
      setBulkVaccine(null);
      setBulkSubjects([]);
    } else {
      setVaccinePickerOpen(false);
      setBulkOpen(false);
      setBulkVaccine(null);
    }
  }, [openAction]);

  const invalidate = () => {
    if (!farmId) return;
    void qc.invalidateQueries({ queryKey: ["techDashboard"] });
    void qc.invalidateQueries({ queryKey: ["techActivity"] });
    void qc.invalidateQueries({ queryKey: ["farmFeedStock", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmHealthEvents", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmVaccineCoverage", farmId] });
    onSuccess();
  };

  const closeVaccineFlow = useCallback(() => {
    setVaccinePickerOpen(false);
    setBulkOpen(false);
    setBulkVaccine(null);
    setBulkSubjects([]);
    onClose();
  }, [onClose]);

  const pickVaccine = useCallback(
    async (vaccineId: string) => {
      const item = coverageQ.data?.items.find((i) => i.vaccine.id === vaccineId);
      if (!item) {
        return;
      }
      setLoadingVaccineId(vaccineId);
      try {
        const res = await fetchFarmVaccineSubjects(
          accessToken,
          farmId,
          vaccineId,
          "unvaccinated",
          activeProfileId
        );
        if (!res.subjects.length) {
          Alert.alert(t("health.errorTitle"), t("health.vaccines.noSubjects"));
          return;
        }
        setBulkVaccine(item.vaccine);
        setBulkSubjects(res.subjects);
        setVaccinePickerOpen(false);
        setBulkOpen(true);
      } catch (e) {
        Alert.alert(t("health.errorTitle"), (e as Error).message);
      } finally {
        setLoadingVaccineId(null);
      }
    },
    [accessToken, activeProfileId, coverageQ.data?.items, farmId, t]
  );

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

      <BaseModal
        visible={openAction === "vaccine" && vaccinePickerOpen}
        onClose={closeVaccineFlow}
        title={t("tech.vaccinePicker.title")}
      >
        {coverageQ.isPending ? (
          <ActivityIndicator color={techColors.primary} style={styles.loader} />
        ) : coverageQ.error ? (
          <Text style={styles.err}>{(coverageQ.error as Error).message}</Text>
        ) : (coverageQ.data?.items ?? []).length === 0 ? (
          <Text style={styles.empty}>{t("tech.vaccinePicker.empty")}</Text>
        ) : (
          <ScrollView style={styles.vaccineList}>
            {(coverageQ.data?.items ?? []).map((item) => {
              const pending = item.stats.overdue + item.stats.upcoming;
              return (
                <Pressable
                  key={item.vaccine.id}
                  style={styles.vaccineRow}
                  disabled={loadingVaccineId != null}
                  onPress={() => void pickVaccine(item.vaccine.id)}
                >
                  <View style={styles.vaccineInfo}>
                    <Text style={styles.vaccineName}>{item.vaccine.name}</Text>
                    <Text style={styles.vaccineMeta}>
                      {t("tech.vaccinePicker.pending", { count: pending })}
                    </Text>
                  </View>
                  {loadingVaccineId === item.vaccine.id ? (
                    <ActivityIndicator color={techColors.primary} />
                  ) : (
                    <Text style={styles.vaccineCta}>{t("tech.vaccinePicker.select")}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </BaseModal>

      {bulkVaccine ? (
        <BulkVaccineModal
          visible={bulkOpen}
          onClose={closeVaccineFlow}
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          vaccine={bulkVaccine}
          initialSubjects={bulkSubjects}
          onSuccess={(count) => {
            invalidate();
            setBulkOpen(false);
            setBulkVaccine(null);
            onClose();
            Alert.alert(
              t("health.vaccines.successTitle"),
              t("health.vaccines.successMessage", { count })
            );
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: mobileSpacing.lg },
  err: { color: techColors.danger ?? "#C2185B" },
  empty: { ...mobileTypography.body, color: techColors.textSecondary },
  vaccineList: { maxHeight: 360 },
  vaccineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: techColors.border
  },
  vaccineInfo: { flex: 1, gap: 2, paddingRight: mobileSpacing.sm },
  vaccineName: {
    ...mobileTypography.cardTitle,
    color: techColors.textPrimary,
    fontSize: 15
  },
  vaccineMeta: {
    ...mobileTypography.meta,
    color: techColors.textSecondary
  },
  vaccineCta: {
    color: techColors.primary,
    fontWeight: "700",
    fontSize: 13
  }
});
