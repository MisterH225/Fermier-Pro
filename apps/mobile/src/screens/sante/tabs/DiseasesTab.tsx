import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScreenSection } from "../../../components/layout/ScreenSection";
import { DiseaseModal } from "../../../components/shared/DiseaseModal";
import { CaseDetailModal } from "../../../components/shared/CaseDetailModal";
import { TreatmentModal } from "../../../components/shared/TreatmentModal";
import { DiseaseKPICards } from "../../../components/sante/diseases/DiseaseKPICards";
import { DiseasePieChart } from "../../../components/sante/diseases/DiseasePieChart";
import { DiseaseAIRecommendations } from "../../../components/sante/diseases/DiseaseAIRecommendations";
import { ActiveCasesList } from "../../../components/sante/diseases/ActiveCasesList";
import {
  DiseaseHistoryList,
  type DiseaseHistoryFilterId
} from "../../../components/sante/diseases/DiseaseHistoryList";
import {
  fetchFarmDiseasesOverview,
  fetchFarmHealthEvents,
  resolveFarmDiseaseCase,
  type AnimalListItem,
  type BatchListItem,
  type FarmHealthRecordRowDto
} from "../../../lib/api";
import { formatAuthError } from "../../../lib/authErrors";
import { animalDisplayTag } from "../../../components/cheptel/animals/animalUtils";
import { invalidateAIInsights } from "../../../services/ai/AIRecommendationService";
import type { RootStackParamList } from "../../../types/navigation";
import { mobileSpacing } from "../../../theme/mobileTheme";

type Props = {
  farmId: string;
  farmName: string;
  accessToken: string;
  activeProfileId?: string | null;
  locale: string;
  livestockMode: "individual" | "batch" | "hybrid";
  animals: AnimalListItem[];
  batches: BatchListItem[];
  navigation: NativeStackNavigationProp<RootStackParamList>;
  onRefresh: () => void;
};

export function DiseasesTab({
  farmId,
  farmName,
  accessToken,
  activeProfileId,
  locale,
  livestockMode,
  animals,
  batches,
  navigation,
  onRefresh
}: Props) {
  const { t } = useTranslation();
  const [diseaseModalOpen, setDiseaseModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<FarmHealthRecordRowDto | null>(null);
  const [detailRecord, setDetailRecord] = useState<FarmHealthRecordRowDto | null>(
    null
  );
  const [treatmentRecordId, setTreatmentRecordId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<DiseaseHistoryFilterId>("month");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const overviewQ = useQuery({
    queryKey: ["farmDiseasesOverview", farmId, activeProfileId],
    queryFn: () => fetchFarmDiseasesOverview(accessToken, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const eventsQ = useQuery({
    queryKey: ["farmHealthEvents", farmId, "disease", activeProfileId],
    queryFn: () =>
      fetchFarmHealthEvents(accessToken, farmId, activeProfileId, {
        kind: "disease"
      }),
    enabled: Boolean(accessToken && farmId)
  });

  const treatmentsQ = useQuery({
    queryKey: ["farmHealthEvents", farmId, "treatment", activeProfileId],
    queryFn: () =>
      fetchFarmHealthEvents(accessToken, farmId, activeProfileId, {
        kind: "treatment"
      }),
    enabled: Boolean(accessToken && farmId)
  });

  const records = eventsQ.data ?? [];
  const allRecords = useMemo(
    () => [...records, ...(treatmentsQ.data ?? [])],
    [records, treatmentsQ.data]
  );

  const handleSuccess = () => {
    onRefresh();
    void overviewQ.refetch();
    void eventsQ.refetch();
    void treatmentsQ.refetch();
    void invalidateAIInsights(farmId, "sante_diseases");
  };

  const resolveMut = useMutation({
    mutationFn: (recordId: string) =>
      resolveFarmDiseaseCase(accessToken, farmId, recordId, activeProfileId),
    onMutate: (recordId) => setResolvingId(recordId),
    onSettled: () => setResolvingId(null),
    onSuccess: () => handleSuccess(),
    onError: (e: unknown) => {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    }
  });

  const openEdit = (record: FarmHealthRecordRowDto) => {
    setEditRecord(record);
    setDiseaseModalOpen(true);
    setDetailRecord(null);
  };

  const navigateToSubject = (record: FarmHealthRecordRowDto) => {
    if (record.entityType !== "animal") {
      return;
    }
    const animal = animals.find((a) => a.id === record.entityId);
    if (!animal) {
      return;
    }
    setDetailRecord(null);
    navigation.navigate("AnimalDetail", {
      farmId,
      farmName,
      animalId: animal.id,
      headline: animalDisplayTag(animal)
    });
  };

  return (
    <View style={styles.wrap}>
      <ScreenSection plain>
        <DiseaseKPICards
          overview={overviewQ.data}
          labels={{
            active: t("health.diseases.kpiActive"),
            resolved: t("health.diseases.kpiResolved"),
            rate: t("health.diseases.kpiRate"),
            isolation: t("health.diseases.kpiIsolation")
          }}
        />
      </ScreenSection>

      <DiseasePieChart overview={overviewQ.data} />

      <DiseaseAIRecommendations
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        hasData={(overviewQ.data?.kpis.activeCases ?? 0) > 0}
      />

      <ActiveCasesList
        records={records}
        animals={animals}
        locale={locale}
        isLoading={eventsQ.isLoading}
        onAddPress={() => {
          setEditRecord(null);
          setDiseaseModalOpen(true);
        }}
        onOpenCase={setDetailRecord}
        onSwipeResolve={(record) => resolveMut.mutate(record.id)}
        onSwipeTreatment={(record) => setTreatmentRecordId(record.id)}
        resolvingId={resolvingId}
      />

      <DiseaseHistoryList
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        animals={animals}
        locale={locale}
        filterId={historyFilter}
        onFilterChange={setHistoryFilter}
      />

      <DiseaseModal
        visible={diseaseModalOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        editRecord={editRecord}
        livestockMode={livestockMode}
        animals={animals}
        batches={batches}
        onClose={() => {
          setDiseaseModalOpen(false);
          setEditRecord(null);
        }}
        onSuccess={handleSuccess}
      />

      <TreatmentModal
        visible={Boolean(treatmentRecordId)}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        diseaseRecordId={treatmentRecordId}
        onClose={() => setTreatmentRecordId(null)}
        onSuccess={handleSuccess}
      />

      <CaseDetailModal
        visible={Boolean(detailRecord)}
        record={detailRecord}
        allRecords={allRecords}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        animals={animals}
        locale={locale}
        onClose={() => setDetailRecord(null)}
        onResolved={handleSuccess}
        onAddTreatment={(record) => {
          setTreatmentRecordId(record.id);
        }}
        onEdit={openEdit}
        onNavigateCheptel={(animalId) => {
          const animal = animals.find((a) => a.id === animalId);
          if (!animal) {
            return;
          }
          navigateToSubject({ ...detailRecord!, entityId: animalId });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md, paddingBottom: mobileSpacing.xl }
});
