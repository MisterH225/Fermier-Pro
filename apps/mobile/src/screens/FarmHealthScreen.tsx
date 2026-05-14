import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MobileAppShell } from "../components/layout";
import { EventList, type EventItem } from "../components/lists";
import { BaseModal } from "../components/modals/BaseModal";
import { useSession } from "../context/SessionContext";
import {
  createFarmHealthRecord,
  type AnimalListItem,
  type BatchListItem,
  type CreateFarmHealthRecordBody,
  type FarmHealthEntityType,
  type FarmHealthRecordKind,
  type FarmHealthRecordRowDto,
  type FarmHealthUpcomingDto,
  fetchFarm,
  fetchFarmAnimals,
  fetchFarmBatches,
  fetchFarmHealthEvents,
  fetchFarmHealthMortalityRate,
  fetchFarmHealthOverview,
  fetchFarmHealthUpcoming,
  linkFarmHealthRecordExpense
} from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmHealth">;

const DISEASE_STATUSES = ["active", "recovered", "dead", "slaughtered"] as const;
const MORTALITY_CAUSES = ["disease", "accident", "unknown", "other"] as const;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDay(iso: string, locale: string): string {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) {
    return "—";
  }
  return x.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function healthPrimaryTitle(r: FarmHealthRecordRowDto): string {
  if (r.kind === "vaccination" && r.vaccination) {
    return r.vaccination.vaccineName;
  }
  if (r.kind === "disease" && r.disease) {
    return r.disease.diagnosis ?? r.disease.caseStatus;
  }
  if (r.kind === "vet_visit" && r.vetVisit) {
    return `${r.vetVisit.vetName} · ${r.vetVisit.reason}`;
  }
  if (r.kind === "treatment" && r.treatment) {
    return r.treatment.drugName;
  }
  if (r.kind === "mortality" && r.mortality) {
    return r.mortality.cause;
  }
  return r.kind;
}

function healthCostParts(
  r: FarmHealthRecordRowDto
): Pick<EventItem, "value" | "valueType"> {
  if (r.kind === "vet_visit" && r.vetVisit?.cost != null && String(r.vetVisit.cost).length) {
    const n =
      typeof r.vetVisit.cost === "number"
        ? r.vetVisit.cost
        : Number.parseFloat(String(r.vetVisit.cost).replace(",", "."));
    if (Number.isFinite(n) && n > 0) {
      return { value: `- ${n.toLocaleString("fr-FR")} FCFA`, valueType: "negative" };
    }
  }
  if (r.kind === "treatment" && r.treatment?.cost != null && String(r.treatment.cost).length) {
    const n =
      typeof r.treatment.cost === "number"
        ? r.treatment.cost
        : Number.parseFloat(String(r.treatment.cost).replace(",", "."));
    if (Number.isFinite(n) && n > 0) {
      return { value: `- ${n.toLocaleString("fr-FR")} FCFA`, valueType: "negative" };
    }
  }
  return { valueType: "neutral" };
}

function healthListIcon(r: FarmHealthRecordRowDto): EventItem["iconType"] {
  if (r.kind === "vaccination" || r.kind === "treatment") {
    return "in";
  }
  if (r.kind === "mortality") {
    return "out";
  }
  if (r.kind === "disease") {
    return "custom";
  }
  return "check";
}

export function FarmHealthScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en" : "fr";
  const qc = useQueryClient();
  const {
    accessToken,
    activeProfileId,
    authMe
  } = useSession();

  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isProducer = profileType === "producer";

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
    queryFn: () =>
      fetchFarmHealthOverview(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const upcomingQuery = useQuery({
    queryKey: ["farmHealthUpcoming", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmHealthUpcoming(accessToken!, farmId, activeProfileId),
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
    queryFn: () =>
      fetchFarmHealthEvents(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const livestockMode =
    (farmQuery.data?.livestockMode as "individual" | "batch" | "hybrid") ||
    "individual";

  const animals = animalsQuery.data ?? [];
  const batches = (batchesQuery.data ?? []).filter((b) => b.status === "active");

  const [subjectType, setSubjectType] = useState<FarmHealthEntityType>("animal");
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    if (!farmQuery.data) {
      return;
    }
    const mode = farmQuery.data.livestockMode;
    if (mode === "individual") {
      setSubjectType("animal");
      if (animals[0]?.id) {
        setSubjectId(animals[0].id);
      }
    } else if (mode === "batch") {
      setSubjectType("group");
      if (batches[0]?.id) {
        setSubjectId(batches[0].id);
      }
    } else {
      if (animals[0]?.id) {
        setSubjectType("animal");
        setSubjectId(animals[0].id);
      } else if (batches[0]?.id) {
        setSubjectType("group");
        setSubjectId(batches[0].id);
      }
    }
  }, [farmQuery.data, animals, batches]);

  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<FarmHealthRecordKind>("vaccination");
  const [occurredDate, setOccurredDate] = useState(() => toIsoDate(new Date()));
  const [notes, setNotes] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [vaccineType, setVaccineType] = useState("");
  const [nextReminderDate, setNextReminderDate] = useState("");
  const [practitioner, setPractitioner] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [caseStatus, setCaseStatus] =
    useState<(typeof DISEASE_STATUSES)[number]>("active");
  const [vetName, setVetName] = useState("");
  const [vetReason, setVetReason] = useState("");
  const [vetContact, setVetContact] = useState("");
  const [vetCost, setVetCost] = useState("");
  const [vetStatus, setVetStatus] = useState<"planned" | "completed">("completed");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [treatCost, setTreatCost] = useState("");
  const [mortCause, setMortCause] =
    useState<(typeof MORTALITY_CAUSES)[number]>("unknown");
  const [mortHeads, setMortHeads] = useState("1");

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkRecordId, setLinkRecordId] = useState<string | null>(null);
  const [linkExpenseId, setLinkExpenseId] = useState("");
  const [healthKindFilter, setHealthKindFilter] = useState<string>("all");
  const [kindPickOpen, setKindPickOpen] = useState(false);

  const resetForm = () => {
    setOccurredDate(toIsoDate(new Date()));
    setNotes("");
    setVaccineName("");
    setVaccineType("");
    setNextReminderDate("");
    setPractitioner("");
    setDiagnosis("");
    setCaseStatus("active");
    setVetName("");
    setVetReason("");
    setVetContact("");
    setVetCost("");
    setVetStatus("completed");
    setDrugName("");
    setDosage("");
    setTreatCost("");
    setMortCause("unknown");
    setMortHeads("1");
  };

  const openForm = (kind: FarmHealthRecordKind) => {
    resetForm();
    setFormKind(kind);
    setFormOpen(true);
  };

  const createMut = useMutation({
    mutationFn: (body: CreateFarmHealthRecordBody) =>
      createFarmHealthRecord(
        accessToken!,
        farmId,
        body,
        activeProfileId
      ),
    onSuccess: () => {
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ["farmHealthEvents", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmHealthOverview", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmHealthUpcoming", farmId] });
      void qc.invalidateQueries({
        queryKey: ["farmHealthMortality", farmId]
      });
      void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmBatches", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
      void qc.invalidateQueries({ queryKey: ["dashboardHealth", farmId] });
    },
    onError: (e: Error) => Alert.alert(t("health.errorTitle"), e.message)
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
      setLinkExpenseId("");
      void eventsQuery.refetch();
      Alert.alert("", t("health.linkOk"));
    },
    onError: (e: Error) => Alert.alert(t("health.errorTitle"), e.message)
  });

  const buildDetail = (): Record<string, unknown> => {
    if (formKind === "vaccination") {
      const d: Record<string, unknown> = { vaccineName: vaccineName.trim() };
      if (vaccineType.trim()) {
        d.vaccineType = vaccineType.trim();
      }
      if (practitioner.trim()) {
        d.practitioner = practitioner.trim();
      }
      if (nextReminderDate.trim()) {
        d.nextReminderAt = `${nextReminderDate.trim()}T12:00:00.000Z`;
      }
      return d;
    }
    if (formKind === "disease") {
      return {
        diagnosis: diagnosis.trim() || undefined,
        caseStatus
      };
    }
    if (formKind === "vet_visit") {
      const d: Record<string, unknown> = {
        vetName: vetName.trim(),
        reason: vetReason.trim()
      };
      if (vetContact.trim()) {
        d.vetContact = vetContact.trim();
      }
      const c = Number.parseFloat(vetCost.replace(",", "."));
      if (Number.isFinite(c) && c > 0) {
        d.cost = c;
      }
      return d;
    }
    if (formKind === "treatment") {
      const d: Record<string, unknown> = { drugName: drugName.trim() };
      if (dosage.trim()) {
        d.dosage = dosage.trim();
      }
      const c = Number.parseFloat(treatCost.replace(",", "."));
      if (Number.isFinite(c) && c > 0) {
        d.cost = c;
      }
      d.startDate = `${occurredDate}T12:00:00.000Z`;
      return d;
    }
    const heads = Number.parseInt(mortHeads, 10);
    return {
      cause: mortCause,
      headcountAffected: Number.isFinite(heads) ? heads : 1
    };
  };

  const submitForm = () => {
    if (!subjectId.trim()) {
      Alert.alert(t("health.errorTitle"), t("health.subjectRequired"));
      return;
    }
    if (formKind === "vaccination" && !vaccineName.trim()) {
      Alert.alert(t("health.errorTitle"), t("health.vaccineNameRequired"));
      return;
    }
    if (formKind === "vet_visit") {
      if (!vetName.trim() || !vetReason.trim()) {
        Alert.alert(t("health.errorTitle"), t("health.vetFieldsRequired"));
        return;
      }
    }
    if (formKind === "treatment" && !drugName.trim()) {
      Alert.alert(t("health.errorTitle"), t("health.drugNameRequired"));
      return;
    }

    const body: CreateFarmHealthRecordBody = {
      kind: formKind,
      entityType: subjectType,
      entityId: subjectId.trim(),
      occurredAt: `${occurredDate}T12:00:00.000Z`,
      notes: notes.trim() || undefined,
      detail: buildDetail()
    };
    if (formKind === "vet_visit" && vetStatus === "planned") {
      body.status = "planned";
    }
    createMut.mutate(body);
  };

  const healthRowsFiltered = useMemo(() => {
    const arr = [...(eventsQuery.data ?? [])];
    arr.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    if (healthKindFilter === "all") {
      return arr;
    }
    return arr.filter((r) => r.kind === healthKindFilter);
  }, [eventsQuery.data, healthKindFilter]);

  const healthHistoryPills = useMemo(
    () => [
      { id: "all", label: t("health.pillAll") },
      { id: "vaccination", label: t("health.pillVaccination") },
      { id: "disease", label: t("health.pillDisease") },
      { id: "vet_visit", label: t("health.pillVet") },
      { id: "treatment", label: t("health.pillTreatment") },
      { id: "mortality", label: t("health.pillMortality") }
    ],
    [t]
  );

  const healthKindShortLabel = useCallback(
    (kind: FarmHealthRecordKind) => {
      switch (kind) {
        case "vaccination":
          return t("health.pillVaccination");
        case "disease":
          return t("health.pillDisease");
        case "vet_visit":
          return t("health.pillVet");
        case "treatment":
          return t("health.pillTreatment");
        case "mortality":
          return t("health.pillMortality");
        default:
          return kind;
      }
    },
    [t]
  );

  const healthEventItems = useMemo((): EventItem[] => {
    return healthRowsFiltered.map((r) => {
      const date = formatDay(r.occurredAt, locale);
      const title = healthPrimaryTitle(r);
      const subtitle = `${healthKindShortLabel(r.kind)} · ${r.entityType} ${r.entityId.slice(0, 8)}…`;
      const cost = healthCostParts(r);
      const iconType = healthListIcon(r);
      return {
        id: r.id,
        title,
        subtitle,
        value: cost.value,
        valueType: cost.valueType,
        date,
        iconType,
        customIcon: iconType === "custom" ? "medkit-outline" : undefined,
        meta: r
      };
    });
  }, [healthRowsFiltered, locale, healthKindShortLabel]);

  const onHealthAddPress = useCallback(() => setKindPickOpen(true), []);

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
          <Text style={styles.meta}>{formatDay(r.occurredAt, locale)}</Text>
          {r.notes ? (
            <Text style={styles.meta}>
              {t("health.detailNotes")} : {r.notes}
            </Text>
          ) : null}
          {isProducer && (r.kind === "vet_visit" || r.kind === "treatment") ? (
            <Pressable
              onPress={() => {
                close();
                setLinkRecordId(r.id);
                setLinkExpenseId("");
                setLinkOpen(true);
              }}
            >
              <Text style={{ color: mobileColors.accent, fontWeight: "700" }}>
                {t("health.linkShort")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    },
    [t, locale, isProducer]
  );

  const refreshing =
    overviewQuery.isFetching ||
    eventsQuery.isFetching ||
    farmQuery.isFetching;

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

  const showAnimalPicker =
    livestockMode === "individual" || livestockMode === "hybrid";
  const showBatchPicker = livestockMode === "batch" || livestockMode === "hybrid";

  const animalLabel = (a: AnimalListItem) =>
    a.tagCode?.trim() || a.publicId.slice(0, 8);
  const batchLabel = (b: BatchListItem) => b.name || b.id.slice(0, 8);

  return (
    <MobileAppShell
      title={farmName ? `${t("health.screenTitle")} — ${farmName}` : t("health.screenTitle")}
      omitBottomTabBar={isProducer}
    >
      <ScrollView
        contentContainerStyle={styles.wrap}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.h1}>{t("health.sectionOverview")}</Text>
        {overviewQuery.isPending && !overview ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : overviewQuery.error ? (
          <Text style={styles.err}>{(overviewQuery.error as Error).message}</Text>
        ) : (
          <View style={styles.card}>
            <Text style={styles.meta}>
              {t("health.activeDiseases")}: {overview?.activeDiseaseCount ?? "—"}
            </Text>
            <Text style={styles.meta}>
              {t("health.mortality30")}:{" "}
              {rate30 != null
                ? `${(Number(rate30) * 100).toLocaleString(locale, { maximumFractionDigits: 2 })} %`
                : "—"}
            </Text>
            <Text style={styles.meta}>
              {t("health.mortality90")}:{" "}
              {rate90 != null
                ? `${(Number(rate90) * 100).toLocaleString(locale, { maximumFractionDigits: 2 })} %`
                : "—"}
            </Text>
          </View>
        )}

        <Text style={styles.h1}>{t("health.subjectTitle")}</Text>
        <Text style={styles.hint}>{t(`health.modeHint.${livestockMode}` as const)}</Text>
        {showAnimalPicker ? (
          <View style={styles.block}>
            <Text style={styles.lab}>{t("health.pickAnimal")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {animals.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.chip,
                    subjectType === "animal" &&
                      subjectId === a.id &&
                      styles.chipOn
                  ]}
                  onPress={() => {
                    setSubjectType("animal");
                    setSubjectId(a.id);
                  }}
                >
                  <Text style={styles.chipTx}>{animalLabel(a)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {showBatchPicker ? (
          <View style={styles.block}>
            <Text style={styles.lab}>{t("health.pickBatch")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {batches.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.chip,
                    subjectType === "group" &&
                      subjectId === b.id &&
                      styles.chipOn
                  ]}
                  onPress={() => {
                    setSubjectType("group");
                    setSubjectId(b.id);
                  }}
                >
                  <Text style={styles.chipTx}>{batchLabel(b)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <EventList
          layout="embedded"
          sectionTitle={t("health.historyTitle")}
          onAddPress={onHealthAddPress}
          data={healthEventItems}
          filters={healthHistoryPills}
          activeFilterId={healthKindFilter}
          onFilterChange={setHealthKindFilter}
          renderDetail={renderHealthDetail}
          emptyMessage={t("health.noEvents")}
          isLoading={eventsQuery.isPending && !(eventsQuery.data ?? []).length}
          pageSize={15}
          loadMoreLabel={t("health.loadMore")}
        />
        <UpcomingVaccines
          items={upcomingQuery.data?.vaccines}
          locale={locale}
          t={t}
        />
      </ScrollView>

      <BaseModal
        visible={kindPickOpen}
        onClose={() => setKindPickOpen(false)}
        title={t("health.addRecordTitle")}
        sheetMaxHeight="70%"
      >
        {(
          [
            "vaccination",
            "disease",
            "vet_visit",
            "treatment",
            "mortality"
          ] as const
        ).map((kind) => (
          <Pressable
            key={kind}
            style={{ paddingVertical: mobileSpacing.md }}
            onPress={() => {
              setKindPickOpen(false);
              openForm(kind);
            }}
          >
            <Text style={styles.meta}>{t(`health.formTitles.${kind}` as const)}</Text>
          </Pressable>
        ))}
      </BaseModal>

      <BaseModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={t(`health.formTitles.${formKind}` as const)}
        footerPrimary={
          <View style={styles.modalActions}>
            <Pressable onPress={() => setFormOpen(false)}>
              <Text style={styles.cancel}>{t("health.cancel")}</Text>
            </Pressable>
            <Pressable
              onPress={submitForm}
              disabled={createMut.isPending}
              style={styles.saveBtn}
            >
              {createMut.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveTx}>{t("health.save")}</Text>
              )}
            </Pressable>
          </View>
        }
      >
        <Text style={styles.lab}>{t("health.fieldDate")}</Text>
        <TextInput
          style={styles.input}
          value={occurredDate}
          onChangeText={setOccurredDate}
          placeholder="YYYY-MM-DD"
        />
        <Text style={styles.lab}>{t("health.fieldNotes")}</Text>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {formKind === "vaccination" ? (
          <>
            <Text style={styles.lab}>{t("health.fieldVaccineName")}</Text>
            <TextInput
              style={styles.input}
              value={vaccineName}
              onChangeText={setVaccineName}
            />
            <Text style={styles.lab}>{t("health.fieldVaccineType")}</Text>
            <TextInput
              style={styles.input}
              value={vaccineType}
              onChangeText={setVaccineType}
            />
            <Text style={styles.lab}>{t("health.fieldNextReminder")}</Text>
            <TextInput
              style={styles.input}
              value={nextReminderDate}
              onChangeText={setNextReminderDate}
              placeholder="YYYY-MM-DD"
            />
            <Text style={styles.lab}>{t("health.fieldPractitioner")}</Text>
            <TextInput
              style={styles.input}
              value={practitioner}
              onChangeText={setPractitioner}
            />
          </>
        ) : null}

        {formKind === "disease" ? (
          <>
            <Text style={styles.lab}>{t("health.fieldDiagnosis")}</Text>
            <TextInput
              style={styles.input}
              value={diagnosis}
              onChangeText={setDiagnosis}
            />
            <Text style={styles.lab}>{t("health.fieldCaseStatus")}</Text>
            <View style={styles.row}>
              {DISEASE_STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, caseStatus === s && styles.chipOn]}
                  onPress={() => setCaseStatus(s)}
                >
                  <Text style={styles.chipTx}>
                    {t(`health.caseStatus.${s}` as const)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {formKind === "vet_visit" ? (
          <>
            <Text style={styles.lab}>{t("health.fieldVetStatus")}</Text>
            <View style={styles.row}>
              {(["completed", "planned"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, vetStatus === s && styles.chipOn]}
                  onPress={() => setVetStatus(s)}
                >
                  <Text style={styles.chipTx}>{t(`health.vetStatus.${s}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.lab}>{t("health.fieldVetName")}</Text>
            <TextInput
              style={styles.input}
              value={vetName}
              onChangeText={setVetName}
            />
            <Text style={styles.lab}>{t("health.fieldVetReason")}</Text>
            <TextInput
              style={styles.input}
              value={vetReason}
              onChangeText={setVetReason}
            />
            <Text style={styles.lab}>{t("health.fieldVetContact")}</Text>
            <TextInput
              style={styles.input}
              value={vetContact}
              onChangeText={setVetContact}
            />
            <Text style={styles.lab}>{t("health.fieldCost")}</Text>
            <TextInput
              style={styles.input}
              value={vetCost}
              onChangeText={setVetCost}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}

        {formKind === "treatment" ? (
          <>
            <Text style={styles.lab}>{t("health.fieldDrugName")}</Text>
            <TextInput
              style={styles.input}
              value={drugName}
              onChangeText={setDrugName}
            />
            <Text style={styles.lab}>{t("health.fieldDosage")}</Text>
            <TextInput
              style={styles.input}
              value={dosage}
              onChangeText={setDosage}
            />
            <Text style={styles.lab}>{t("health.fieldCost")}</Text>
            <TextInput
              style={styles.input}
              value={treatCost}
              onChangeText={setTreatCost}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}

        {formKind === "mortality" ? (
          <>
            <Text style={styles.lab}>{t("health.fieldMortCause")}</Text>
            <View style={styles.row}>
              {MORTALITY_CAUSES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, mortCause === c && styles.chipOn]}
                  onPress={() => setMortCause(c)}
                >
                  <Text style={styles.chipTx}>
                    {t(`health.mortCause.${c}` as const)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {subjectType === "group" ? (
              <>
                <Text style={styles.lab}>{t("health.fieldHeadcount")}</Text>
                <TextInput
                  style={styles.input}
                  value={mortHeads}
                  onChangeText={setMortHeads}
                  keyboardType="number-pad"
                />
              </>
            ) : null}
            <Text style={styles.mortHint}>{t("health.mortalityHint")}</Text>
          </>
        ) : null}
      </BaseModal>

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
                if (!linkRecordId || !linkExpenseId.trim()) {
                  return;
                }
                linkMut.mutate();
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

function UpcomingVaccines({
  items,
  locale,
  t
}: {
  items: FarmHealthUpcomingDto["vaccines"] | undefined;
  locale: string;
  t: (k: string) => string;
}) {
  if (!items?.length) {
    return null;
  }
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>{t("health.upcomingVaccines")}</Text>
      {items.slice(0, 8).map((v, i) => (
        <Text key={`${v.healthRecord.id}-${i}`} style={styles.meta}>
          {v.vaccineName} ·{" "}
          {v.nextReminderAt
            ? formatDay(v.nextReminderAt, locale)
            : "—"}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.md
  },
  h1: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  h2: {
    ...mobileTypography.body,
    fontWeight: "700",
    marginBottom: mobileSpacing.xs
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  card: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  meta: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontSize: 14
  },
  err: { color: mobileColors.error },
  block: { marginBottom: mobileSpacing.sm },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    marginRight: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}18`
  },
  chipTx: { fontSize: 13, color: mobileColors.textPrimary },
  row: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: mobileSpacing.md
  },
  cancel: { color: mobileColors.textSecondary, fontWeight: "600" },
  saveBtn: {
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.sm
  },
  saveTx: { color: "#fff", fontWeight: "700" },
  mortHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  }
});
