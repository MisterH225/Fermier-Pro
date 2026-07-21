import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";
import { optimisticHealthEvent } from "../../lib/offline/optimistic";
import { isOfflineQueuedResult } from "../../lib/offline/types";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { MobileAppShell } from "../../components/layout";
import { TabContent, TabSelector } from "../../components/tabs";
import { EventList, type EventItem } from "../../components/lists";
import {
  HealthRecordFormModal,
  type HealthFormState
} from "../../components/sante/HealthRecordFormModal";
import {
  HEALTH_KIND_TABS,
  HEALTH_RECORD_ADD_KINDS,
  healthKindSectionTitle,
  healthKindShortLabel,
  recordToEventItem,
  toIsoDate,
  type HealthScreenTab
} from "../../components/sante/healthUtils";
import { BaseModal } from "../../components/modals/BaseModal";
import { invalidateAIInsights } from "../../services/ai/AIRecommendationService";
import { useScreenTitle } from "../../hooks/useScreenTitle";
import { useTechFarmPermissions } from "../../hooks/useTechFarmPermissions";
import { TechReadOnlyBanner } from "../../components/technician/TechReadOnlyBanner";
import { useSession } from "../../context/SessionContext";
import { VetAppointmentActionsBanner } from "../../components/vet/VetAppointmentActionsBanner";
import {
  createFarmHealthRecord,
  removeFarmHealthVetVisit,
  type CreateFarmHealthRecordBody,
  type FarmHealthEntityType,
  type FarmHealthRecordKind,
  type FarmHealthRecordRowDto,
  fetchFarm,
  fetchFarmAnimals,
  fetchFarmBatches,
  fetchFarmHealthEvents,
  fetchFarmHealthMortalityRate,
  fetchFarmHealthOverview,
  fetchFarmHealthUpcoming,
  linkFarmHealthRecordExpense
} from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { HealthOverviewTab } from "./tabs/HealthOverviewTab";
import { HealthKindListTab } from "./tabs/HealthKindListTab";
import { DiseasesTab } from "./tabs/DiseasesTab";
import { VetVisitsTab } from "./tabs/VetVisitsTab";
import { MortalitiesTab } from "./tabs/MortalitiesTab";
import { VaccinesTab } from "./tabs/VaccinesTab";
import { formatHealthDay, canDeleteVetVisit } from "../../components/sante/healthUtils";
import { producerColors } from "../../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FarmHealth">;

const emptyForm = (): HealthFormState => ({
  occurredDate: toIsoDate(new Date()),
  notes: "",
  vaccineName: "",
  vaccineType: "",
  nextReminderDate: "",
  practitioner: "",
  diagnosis: "",
  caseStatus: "active",
  vetName: "",
  vetReason: "",
  vetContact: "",
  vetCost: "",
  vetStatus: "completed",
  drugName: "",
  dosage: "",
  treatCost: "",
  mortCause: "unknown",
  mortHeads: "1"
});

export function SanteScreen({ route, navigation }: Props) {
  const {
    farmId,
    farmName,
    initialTab,
    openFormKind,
    openDiseaseId,
    openVisitId,
    openVaccineName
  } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en" : "fr";
  const qc = useQueryClient();
  const { accessToken, activeProfileId, authMe } = useSession();
  const isProducer =
    authMe?.profiles.find((p) => p.id === activeProfileId)?.type === "producer";
  const techPerms = useTechFarmPermissions(farmId, "sante");

  useScreenTitle(navigation, t("health.screenTitle"), {
    headerRight: () => (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("VetSearch", {
            farmId,
            farmName,
            bookingSource: "farm_dossier"
          })
        }
        style={styles.headerBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.headerBtnText}>
          🔍 {t("health.findVetShort")}
        </Text>
      </TouchableOpacity>
    )
  });

  const farmQuery = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });
  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });
  const batchesQuery = useQuery({
    queryKey: ["farmBatches", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });
  const overviewQuery = useQuery({
    queryKey: ["farmHealthOverview", farmId, activeProfileId],
    queryFn: () => fetchFarmHealthOverview(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });
  const upcomingQuery = useQuery({
    queryKey: ["farmHealthUpcoming", farmId, activeProfileId],
    queryFn: () => fetchFarmHealthUpcoming(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });
  const mort30Query = useQuery({
    queryKey: ["farmHealthMortality", farmId, "30", activeProfileId],
    queryFn: () =>
      fetchFarmHealthMortalityRate(accessToken!, farmId, activeProfileId, "30"),
    enabled: Boolean(accessToken && farmId)
  });
  const mort90Query = useQuery({
    queryKey: ["farmHealthMortality", farmId, "90", activeProfileId],
    queryFn: () =>
      fetchFarmHealthMortalityRate(accessToken!, farmId, activeProfileId, "90"),
    enabled: Boolean(accessToken && farmId)
  });
  const eventsQuery = useQuery({
    queryKey: ["farmHealthEvents", farmId, activeProfileId],
    queryFn: () => fetchFarmHealthEvents(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const livestockMode =
    (farmQuery.data?.livestockMode as "individual" | "batch" | "hybrid") ||
    "individual";
  const animals = animalsQuery.data ?? [];
  const batches = (batchesQuery.data ?? []).filter((b) => b.status === "active");
  const allRecords = eventsQuery.data ?? [];

  const [subjectType, setSubjectType] = useState<FarmHealthEntityType>("animal");
  const [subjectId, setSubjectId] = useState("");
  const [healthTab, setHealthTab] = useState<HealthScreenTab>(
    initialTab ?? "overview"
  );

  useEffect(() => {
    if (initialTab) {
      setHealthTab(initialTab);
    }
  }, [initialTab]);
  const [pendingOpenForm, setPendingOpenForm] = useState(openFormKind);
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<FarmHealthRecordKind>("vaccination");
  const [form, setForm] = useState<HealthFormState>(emptyForm);
  const [kindPickOpen, setKindPickOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkRecordId, setLinkRecordId] = useState<string | null>(null);
  const [linkExpenseId, setLinkExpenseId] = useState("");

  // On ne dépend pas des références `animals` / `batches` (recréées à chaque
  // render via `?? []` et `.filter(...)` → boucle « Maximum update depth »).
  // On suit uniquement les IDs du premier animal / lot, qui sont des strings
  // stables tant que le cache react-query ne change pas.
  const firstAnimalId = animals[0]?.id ?? null;
  const firstBatchId = batches[0]?.id ?? null;
  useEffect(() => {
    if (!farmQuery.data) return;
    const mode = farmQuery.data.livestockMode;
    if (mode === "individual" && firstAnimalId) {
      setSubjectType("animal");
      setSubjectId(firstAnimalId);
    } else if (mode === "batch" && firstBatchId) {
      setSubjectType("group");
      setSubjectId(firstBatchId);
    } else if (firstAnimalId) {
      setSubjectType("animal");
      setSubjectId(firstAnimalId);
    } else if (firstBatchId) {
      setSubjectType("group");
      setSubjectId(firstBatchId);
    }
  }, [farmQuery.data, firstAnimalId, firstBatchId]);

  const openForm = (kind: FarmHealthRecordKind) => {
    setForm(emptyForm());
    setFormKind(kind);
    setFormOpen(true);
  };

  useEffect(() => {
    if (!pendingOpenForm || !farmQuery.data) {
      return;
    }
    setHealthTab(pendingOpenForm);
    openForm(pendingOpenForm);
    setPendingOpenForm(undefined);
  }, [pendingOpenForm, farmQuery.data]);

  const invalidateHealth = () => {
    void invalidateAIInsights(farmId, "sante");
    void invalidateAIInsights(farmId, "global_dashboard");
    void qc.invalidateQueries({ queryKey: ["farmHealthEvents", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmHealthOverview", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmHealthUpcoming", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmHealthMortality", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmVaccineCoverage", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmBatches", farmId] });
  };

  const createMut = useOfflineMutation<CreateFarmHealthRecordBody>({
    farmId,
    type: "health.createRecord",
    label: t("health.screenTitle"),
    mutationFn: (body) =>
      createFarmHealthRecord(accessToken!, farmId, body, activeProfileId),
    buildOfflineItem: (body) => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/health/events`,
          body
        }
      ],
      invalidateRoots: [
        "farmHealthEvents",
        "farmHealthOverview",
        "farmHealthUpcoming",
        "farmHealthMortality",
        "farmVaccineCoverage",
        "farmAnimals",
        "farmBatches"
      ]
    }),
    applyOptimistic: (body, queueItemId) => {
      optimisticHealthEvent(qc, farmId, queueItemId, {
        type: body.kind,
        kind: body.kind,
        entityType: body.entityType,
        entityId: body.entityId,
        status: body.status,
        notes: body.notes
      });
    },
    onSuccess: (data) => {
      setFormOpen(false);
      invalidateHealth();
      if (isOfflineQueuedResult(data)) {
        Alert.alert(t("common.infoTitle"), offlineQueuedMessage(t));
      }
    },
    onQueued: () => {
      setFormOpen(false);
      invalidateHealth();
      Alert.alert(t("common.infoTitle"), offlineQueuedMessage(t));
    },
    onError: (e: Error) => Alert.alert(t("health.errorTitle"), getUserFacingError(e, t))
  });

  const deleteMut = useMutation({
    mutationFn: (recordId: string) =>
      removeFarmHealthVetVisit(accessToken!, farmId, recordId, activeProfileId),
    onSuccess: () => {
      invalidateHealth();
      void qc.invalidateQueries({ queryKey: ["vetAppointments"] });
    },
    onError: (e: Error) => Alert.alert(t("health.errorTitle"), getUserFacingError(e, t))
  });

  const linkMut = useMutation({
    mutationFn: () =>
      linkFarmHealthRecordExpense(
        accessToken!,
        farmId,
        linkRecordId!,
        linkExpenseId.trim(),
        activeProfileId
      ),
    onSuccess: () => {
      setLinkOpen(false);
      setLinkRecordId(null);
      void eventsQuery.refetch();
      Alert.alert(t("common.successTitle"), t("health.linkOk"));
    },
    onError: (e: Error) => Alert.alert(t("health.errorTitle"), getUserFacingError(e, t))
  });

  const buildDetail = (): Record<string, unknown> => {
    if (formKind === "vaccination") {
      const d: Record<string, unknown> = { vaccineName: form.vaccineName.trim() };
      if (form.vaccineType.trim()) d.vaccineType = form.vaccineType.trim();
      if (form.practitioner.trim()) d.practitioner = form.practitioner.trim();
      if (form.nextReminderDate.trim()) {
        d.nextReminderAt = `${form.nextReminderDate.trim()}T12:00:00.000Z`;
      }
      return d;
    }
    if (formKind === "vet_visit") {
      const d: Record<string, unknown> = {
        vetName: form.vetName.trim(),
        reason: form.vetReason.trim()
      };
      if (form.vetContact.trim()) d.vetContact = form.vetContact.trim();
      const c = Number.parseFloat(form.vetCost.replace(",", "."));
      if (Number.isFinite(c) && c > 0) d.cost = c;
      return d;
    }
    if (formKind === "treatment") {
      const d: Record<string, unknown> = { drugName: form.drugName.trim() };
      if (form.dosage.trim()) d.dosage = form.dosage.trim();
      const c = Number.parseFloat(form.treatCost.replace(",", "."));
      if (Number.isFinite(c) && c > 0) d.cost = c;
      d.startDate = `${form.occurredDate}T12:00:00.000Z`;
      return d;
    }
    const heads = Number.parseInt(form.mortHeads, 10);
    return {
      cause: form.mortCause,
      headcountAffected: Number.isFinite(heads) ? heads : 1
    };
  };

  const submitForm = () => {
    if (!subjectId.trim()) {
      Alert.alert(t("health.errorTitle"), t("health.subjectRequired"));
      return;
    }
    if (formKind === "vaccination" && !form.vaccineName.trim()) {
      Alert.alert(t("health.errorTitle"), t("health.vaccineNameRequired"));
      return;
    }
    if (formKind === "vet_visit" && (!form.vetName.trim() || !form.vetReason.trim())) {
      Alert.alert(t("health.errorTitle"), t("health.vetFieldsRequired"));
      return;
    }
    if (formKind === "treatment" && !form.drugName.trim()) {
      Alert.alert(t("health.errorTitle"), t("health.drugNameRequired"));
      return;
    }
    const body: CreateFarmHealthRecordBody = {
      kind: formKind,
      entityType: subjectType,
      entityId: subjectId.trim(),
      occurredAt: `${form.occurredDate}T12:00:00.000Z`,
      notes: form.notes.trim() || undefined,
      detail: buildDetail()
    };
    if (formKind === "vet_visit" && form.vetStatus === "planned") {
      body.status = "planned";
    }
    createMut.mutate(body);
  };

  const renderHealthDetail = useCallback(
    (item: EventItem, { close }: { close: () => void }) => {
      const r = item.meta as FarmHealthRecordRowDto;
      return (
        <View style={{ gap: mobileSpacing.sm, paddingBottom: mobileSpacing.md }}>
          <Text style={styles.meta}>
            {t("health.detailKind")} : {t(`health.formTitles.${r.kind}` as const)}
          </Text>
          <Text style={styles.meta}>
            {t("health.detailEntity")} : {r.entityType} {r.entityId}
          </Text>
          <Text style={styles.meta}>{formatHealthDay(r.occurredAt, locale)}</Text>
          {r.notes ? (
            <Text style={styles.meta}>
              {t("health.detailNotes")} : {r.notes}
            </Text>
          ) : null}
          {r.kind === "vet_visit" && r.vetVisit ? (
            <View style={{ gap: 4 }}>
              <Text style={styles.meta}>
                {t("health.detailVetName")} : {r.vetVisit.vetName}
              </Text>
              <Text style={styles.meta}>
                {t("health.detailVetReason")} : {r.vetVisit.reason}
              </Text>
              {r.vetVisit.subjectsTreated ? (
                <Text style={styles.meta}>
                  {t("health.detailSubjectsTreated")} :{" "}
                  {r.vetVisit.subjectsTreated}
                </Text>
              ) : null}
              {r.vetVisit.diagnosis ? (
                <Text style={styles.meta}>
                  {t("health.detailDiagnosis")} : {r.vetVisit.diagnosis}
                </Text>
              ) : null}
              {r.vetVisit.prescription ? (
                <Text style={styles.meta}>
                  {t("health.detailPrescription")} : {r.vetVisit.prescription}
                </Text>
              ) : null}
            </View>
          ) : null}
          {isProducer && (r.kind === "vet_visit" || r.kind === "treatment") ? (
            <Pressable
              onPress={() => {
                close();
                setLinkRecordId(r.id);
                setLinkOpen(true);
              }}
            >
              <Text style={{ color: mobileColors.accent, fontWeight: "700" }}>
                {t("health.linkShort")}
              </Text>
            </Pressable>
          ) : null}
          {isProducer && canDeleteVetVisit(r) ? (
            <Pressable
              onPress={() => {
                Alert.alert(
                  t("health.deleteVisitTitle"),
                  t("health.deleteVisitBody"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("common.delete"),
                      style: "destructive",
                      onPress: () => {
                        close();
                        deleteMut.mutate(r.id);
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={{ color: mobileColors.error, fontWeight: "700" }}>
                {t("health.deleteVisitCta")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    },
    [t, locale, isProducer, deleteMut]
  );

  const refreshing =
    overviewQuery.isFetching || eventsQuery.isFetching || farmQuery.isFetching;

  const onRefresh = useCallback(() => {
    void overviewQuery.refetch();
    void upcomingQuery.refetch();
    void mort30Query.refetch();
    void mort90Query.refetch();
    void eventsQuery.refetch();
    void farmQuery.refetch();
    void animalsQuery.refetch();
    void batchesQuery.refetch();
  }, [
    overviewQuery,
    upcomingQuery,
    mort30Query,
    mort90Query,
    eventsQuery,
    farmQuery,
    animalsQuery,
    batchesQuery
  ]);

  const overview = overviewQuery.data;
  const rate30 = mort30Query.data?.rate;
  const rate90 = mort90Query.data?.rate;

  const mortalityPct30 = useMemo(() => {
    if (rate30 != null) return Number(rate30) * 100;
    const raw = overview?.mortalityRate30d;
    if (raw == null) return null;
    const n = Number.parseFloat(String(raw));
    return Number.isFinite(n) ? n * 100 : null;
  }, [rate30, overview?.mortalityRate30d]);

  const nextVetLabel = useMemo(() => {
    const n = overview?.nextVetVisitModule;
    if (!n) {
      return "—";
    }
    const at = new Date(n.at);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (
      n.source === "health_record" &&
      (Number.isNaN(at.getTime()) || at < startOfToday)
    ) {
      return "—";
    }
    let label = formatHealthDay(n.at, locale);
    if (n.reason) {
      label += ` · ${n.reason}`;
    }
    if (
      n.source === "vet_appointment" &&
      n.appointmentStatus === "APPOINTMENT_REQUESTED"
    ) {
      label += ` (${t("producer.vetAppointments.waitingForVet")})`;
    }
    return label;
  }, [overview?.nextVetVisitModule, locale, t]);

  const chartMonthLabel = useCallback(
    (monthKey: string) => {
      const [y, m] = monthKey.split("-").map(Number);
      if (!y || !m) return monthKey;
      return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "short" });
    },
    [locale]
  );

  const mortalityChartLines = useMemo(
    () => [
      {
        key: "mortality",
        label: t("health.chartMortality"),
        color: producerColors.chartDisease,
        data: overview?.charts.mortalityHeadcount ?? []
      }
    ],
    [overview?.charts.mortalityHeadcount, t]
  );

  const diseaseChartLines = useMemo(
    () => [
      {
        key: "new_cases",
        label: t("health.chartDiseaseNew"),
        color: producerColors.chartAccident,
        data: overview?.charts.diseaseNew ?? []
      },
      {
        key: "resolved",
        label: t("health.chartDiseaseResolved"),
        color: producerColors.chartOk,
        data: overview?.charts.diseaseResolved ?? []
      }
    ],
    [overview?.charts.diseaseNew, overview?.charts.diseaseResolved, t]
  );

  const vaccineChartLines = useMemo(
    () => [
      {
        key: "planned",
        label: t("health.chartVaccinePlanned"),
        color: producerColors.chartOther,
        data: overview?.charts.vaccinationsPlanned ?? []
      },
      {
        key: "done",
        label: t("health.chartVaccineDone"),
        color: producerColors.chartOk,
        data: overview?.charts.vaccinationsDone ?? []
      }
    ],
    [overview?.charts.vaccinationsPlanned, overview?.charts.vaccinationsDone, t]
  );

  const mortalityDonutSlices = useMemo(() => {
    const palette: Record<string, string> = {
      disease: producerColors.chartDisease,
      accident: producerColors.chartAccident,
      unknown: producerColors.chartUnknown,
      other: producerColors.chartOther
    };
    const rows = overview?.charts.mortalityCauses ?? [];
    const total = rows.reduce((s, r) => s + r.value, 0);
    return rows
      .filter((r) => r.value > 0)
      .map((r) => ({
        label: t(`health.mortCause.${r.cause}` as const),
        value: r.value,
        color: palette[r.cause] ?? producerColors.chartUnknown,
        display:
          total > 0 ? `${Math.round((r.value / total) * 100)} %` : undefined
      }));
  }, [overview?.charts.mortalityCauses, t]);

  const tabScroll = (children: ReactNode) => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabScrollGrow}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <TabContent>{children}</TabContent>
    </ScrollView>
  );

  const listCommon = {
    locale,
    livestockMode,
    animals,
    batches,
    subjectType,
    subjectId,
    onSubjectSelect: (type: FarmHealthEntityType, id: string) => {
      setSubjectType(type);
      setSubjectId(id);
    },
    records: allRecords,
    isLoading: eventsQuery.isPending && !allRecords.length,
    renderDetail: renderHealthDetail
  };

  const vaccinationHistoryItems = useMemo((): EventItem[] => {
    const label = healthKindShortLabel("vaccination", t);
    return allRecords
      .filter((r) => r.kind === "vaccination")
      .map((r) => recordToEventItem(r, locale, label));
  }, [allRecords, locale, t]);

  if (techPerms.isTech && techPerms.loading) {
    return (
      <View style={styles.gateCentered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (techPerms.isTech && !techPerms.canView) {
    return (
      <View style={styles.gateCentered}>
        <Text style={styles.gateError}>{t("tech.permissionDenied")}</Text>
      </View>
    );
  }

  const readOnly = techPerms.readOnly;

  return (
    <MobileAppShell hideTopBar omitBottomTabBar={isProducer}>
      {readOnly ? <TechReadOnlyBanner /> : null}
      <TabSelector
        testIDPrefix="sante-tab"
        activeTab={healthTab}
        onTabChange={(key) => setHealthTab(key as HealthScreenTab)}
        tabs={[
          {
            key: "overview",
            label: t("health.sectionOverview"),
            content: tabScroll(
              <>
                {accessToken ? (
                  <VetAppointmentActionsBanner
                    accessToken={accessToken}
                    activeProfileId={activeProfileId}
                    farmId={farmId}
                  />
                ) : null}
                <HealthOverviewTab
                farmId={farmId}
                accessToken={accessToken}
                activeProfileId={activeProfileId}
                locale={locale}
                overview={overview}
                upcomingVaccines={upcomingQuery.data?.vaccines}
                mortalityPct30={mortalityPct30}
                isPending={overviewQuery.isPending}
                error={
                  overviewQuery.error instanceof Error
                    ? overviewQuery.error
                    : null
                }
                mortalityChartLines={mortalityChartLines}
                diseaseChartLines={diseaseChartLines}
                vaccineChartLines={vaccineChartLines}
                mortalityDonutSlices={mortalityDonutSlices}
                chartMonthLabel={chartMonthLabel}
                globalStatusLabel={t(
                  `health.globalStatus.${overview?.globalHealthStatus ?? "good"}` as const
                )}
                globalStatusVariant={
                  overview?.globalHealthStatus === "critical"
                    ? "orange"
                    : overview?.globalHealthStatus === "warning"
                      ? "yellow"
                      : "green"
                }
                nextVetLabel={nextVetLabel}
              />
              </>
            )
          },
          {
            key: "vaccination",
            label: healthKindSectionTitle("vaccination", t),
            content: tabScroll(
              <>
                {accessToken ? (
                  <VaccinesTab
                    farmId={farmId}
                    accessToken={accessToken}
                    activeProfileId={activeProfileId}
                    livestockMode={livestockMode}
                    highlightVaccineName={openVaccineName}
                  />
                ) : null}
                <EventList
                  layout="embedded"
                  sectionTitle={t("health.historyTitle")}
                  onAddPress={readOnly ? undefined : () => openForm("vaccination")}
                  data={vaccinationHistoryItems}
                  renderDetail={renderHealthDetail}
                  emptyMessage={t("health.noEvents")}
                  isLoading={listCommon.isLoading}
                  pageSize={15}
                  loadMoreLabel={t("health.loadMore")}
                />
              </>
            )
          },
          {
            key: "disease",
            label: healthKindSectionTitle("disease", t),
            content: tabScroll(
              <DiseasesTab
                farmId={farmId}
                farmName={farmName}
                accessToken={accessToken!}
                activeProfileId={activeProfileId}
                locale={locale}
                livestockMode={livestockMode}
                animals={animals}
                batches={batches}
                navigation={navigation}
                readOnly={readOnly}
                initialOpenDiseaseId={openDiseaseId}
                onRefresh={() => {
                  void qc.invalidateQueries({ queryKey: ["farmHealthEvents", farmId] });
                  void qc.invalidateQueries({ queryKey: ["farmDiseasesOverview", farmId] });
                  void qc.invalidateQueries({ queryKey: ["farmDiseaseHistory", farmId] });
                  void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
                  void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
                  void invalidateAIInsights(farmId, "sante");
                  void invalidateAIInsights(farmId, "sante_diseases");
                }}
              />
            )
          },
          {
            key: "vet_visit",
            label: healthKindSectionTitle("vet_visit", t),
            content: tabScroll(
              <VetVisitsTab
                upcoming={upcomingQuery.data}
                farmId={farmId}
                accessToken={accessToken!}
                activeProfileId={activeProfileId}
                onAddPress={readOnly ? undefined : () => openForm("vet_visit")}
                initialOpenVisitId={openVisitId}
                onDeleteVisit={(recordId) => deleteMut.mutate(recordId)}
                {...listCommon}
              />
            )
          },
          {
            key: "treatment",
            label: healthKindSectionTitle("treatment", t),
            content: tabScroll(
              <HealthKindListTab
                kind="treatment"
                onAddPress={readOnly ? undefined : () => openForm("treatment")}
                {...listCommon}
              />
            )
          },
          {
            key: "mortality",
            label: healthKindSectionTitle("mortality", t),
            content: tabScroll(
              <MortalitiesTab
                mortalityRate30={rate30 != null ? Number(rate30) : null}
                mortalityRate90={rate90 != null ? Number(rate90) : null}
                onAddPress={readOnly ? undefined : () => openForm("mortality")}
                {...listCommon}
              />
            )
          }
        ]}
      />

      <BaseModal
        visible={kindPickOpen}
        onClose={() => setKindPickOpen(false)}
        title={t("health.addRecordTitle")}
        sheetMaxHeight="70%"
      >
        {HEALTH_RECORD_ADD_KINDS.map((kind) => (
          <Pressable
            key={kind}
            style={{ paddingVertical: mobileSpacing.md }}
            onPress={() => {
              setKindPickOpen(false);
              openForm(kind);
            }}
          >
            <Text style={styles.meta}>
              {t(`health.formTitles.${kind}` as const)}
            </Text>
          </Pressable>
        ))}
      </BaseModal>

      <HealthRecordFormModal
        visible={formOpen}
        farmId={farmId}
        formKind={formKind}
        subjectType={subjectType}
        saving={createMut.isPending}
        form={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
      />

      <BaseModal
        visible={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={t("health.linkExpenseTitle")}
        footerPrimary={
          <View style={styles.modalActions}>
            <Pressable onPress={() => setLinkOpen(false)}>
              <Text style={styles.cancel}>{t("health.cancel")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (linkRecordId && linkExpenseId.trim()) linkMut.mutate();
              }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveTx}>{t("health.linkSubmit")}</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={styles.lab}>{t("health.fieldExpenseId")}</Text>
        <TextInput
          style={styles.input}
          value={linkExpenseId}
          onChangeText={setLinkExpenseId}
          autoCapitalize="none"
        />
      </BaseModal>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  gateCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.canvas
  },
  gateError: { ...mobileTypography.body, color: mobileColors.error, textAlign: "center" },
  tabScroll: { flex: 1 },
  tabScrollGrow: { flexGrow: 1 },
  headerBtn: { marginRight: mobileSpacing.sm },
  headerBtnText: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  },
  meta: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.md
  },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cancel: { color: mobileColors.textSecondary, fontWeight: "600" },
  saveBtn: {
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.sm
  },
  saveTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
