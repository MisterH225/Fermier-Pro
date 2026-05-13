import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { ProducerEventsFab } from "../components/producer/ProducerEventsFab";
import { MobileAppShell } from "../components/layout";
import { useSession } from "../context/SessionContext";
import { dashboardRouteForActiveProfileType } from "../lib/dashboardHomeRoute";
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


  const goHome = useCallback(() => {
    const r = dashboardRouteForActiveProfileType(profileType);
    switch (r) {
      case "ProducerDashboard":
        navigation.navigate("ProducerDashboard");
        break;
      case "BuyerDashboard":
        navigation.navigate("BuyerDashboard");
        break;
      case "VeterinarianDashboard":
        navigation.navigate("VeterinarianDashboard");
        break;
      case "TechnicianDashboard":
        navigation.navigate("TechnicianDashboard");
        break;
      default:
        navigation.navigate("ProducerDashboard");
    }
  }, [navigation, profileType]);


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

  const byKind = useCallback(
    (kind: FarmHealthRecordKind) =>
      (eventsQuery.data ?? []).filter((r) => r.kind === kind),
    [eventsQuery.data]
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

  const rowLine = (r: FarmHealthRecordRowDto) => {
    const day = formatDay(r.occurredAt, locale);
    if (r.kind === "vaccination" && r.vaccination) {
      return `${day} · ${r.vaccination.vaccineName}`;
    }
    if (r.kind === "disease" && r.disease) {
      return `${day} · ${r.disease.diagnosis ?? r.disease.caseStatus}`;
    }
    if (r.kind === "vet_visit" && r.vetVisit) {
      return `${day} · ${r.vetVisit.vetName} — ${r.vetVisit.reason}`;
    }
    if (r.kind === "treatment" && r.treatment) {
      return `${day} · ${r.treatment.drugName}`;
    }
    if (r.kind === "mortality" && r.mortality) {
      return `${day} · ${r.mortality.cause}`;
    }
    return `${day} · ${r.kind}`;
  };

  return (
    <MobileAppShell
      title={farmName ? `${t("health.screenTitle")} — ${farmName}` : t("health.screenTitle")}
      omitBottomTabBar={isProducer}
      activeTab={isProducer ? undefined : "health"}
      floatingAction={
        isProducer ? (
          <ProducerEventsFab onPress={() => navigation.navigate("FarmEventsFeed")} />
        ) : undefined
      }
      onTabChange={
        isProducer
          ? undefined
          : (tab) => {
              if (tab === "home") {
                goHome();
              }
              if (tab === "cheptel") {
                if (profileType === "buyer") {
                  navigation.navigate("MarketplaceMyListings");
                  return;
                }
                navigation.navigate("FarmList");
              }
              if (tab === "profile") {
                navigation.navigate("Account");
              }
            }
      }
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
            {(overview?.alerts ?? []).map((a, i) => (
              <Text key={`${a}-${i}`} style={styles.alert}>
                {a}
              </Text>
            ))}
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

        <SectionBlock
          title={t("health.sectionVaccinations")}
          onAdd={() => openForm("vaccination")}
          rows={byKind("vaccination")}
          rowLine={rowLine}
        />
        <UpcomingVaccines
          items={upcomingQuery.data?.vaccines}
          locale={locale}
          t={t}
        />

        <SectionBlock
          title={t("health.sectionDiseases")}
          onAdd={() => openForm("disease")}
          rows={byKind("disease")}
          rowLine={rowLine}
        />

        <SectionBlock
          title={t("health.sectionVet")}
          onAdd={() => openForm("vet_visit")}
          rows={byKind("vet_visit")}
          rowLine={rowLine}
          linkLabel={t("health.linkShort")}
          onLink={
            isProducer
              ? (id) => {
                  setLinkRecordId(id);
                  setLinkExpenseId("");
                  setLinkOpen(true);
                }
              : undefined
          }
          kindsForLink={["vet_visit"]}
        />

        <SectionBlock
          title={t("health.sectionTreatments")}
          onAdd={() => openForm("treatment")}
          rows={byKind("treatment")}
          rowLine={rowLine}
          linkLabel={t("health.linkShort")}
          onLink={
            isProducer
              ? (id) => {
                  setLinkRecordId(id);
                  setLinkExpenseId("");
                  setLinkOpen(true);
                }
              : undefined
          }
          kindsForLink={["treatment"]}
        />

        <SectionBlock
          title={t("health.sectionMortalities")}
          onAdd={() => openForm("mortality")}
          rows={byKind("mortality")}
          rowLine={rowLine}
        />
      </ScrollView>

      <Modal visible={formOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t(`health.formTitles.${formKind}` as const)}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
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
            </ScrollView>
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
          </View>
        </View>
      </Modal>

      <Modal visible={linkOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("health.linkExpenseTitle")}</Text>
            <Text style={styles.lab}>{t("health.fieldExpenseId")}</Text>
            <TextInput
              style={styles.input}
              value={linkExpenseId}
              onChangeText={setLinkExpenseId}
              autoCapitalize="none"
            />
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
          </View>
        </View>
      </Modal>
    </MobileAppShell>
  );
}

function SectionBlock({
  title,
  onAdd,
  rows,
  rowLine,
  onLink,
  kindsForLink,
  linkLabel
}: {
  title: string;
  onAdd: () => void;
  rows: FarmHealthRecordRowDto[];
  rowLine: (r: FarmHealthRecordRowDto) => string;
  onLink?: (recordId: string) => void;
  kindsForLink?: FarmHealthRecordKind[];
  linkLabel?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.h1}>{title}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addTx}>+</Text>
        </TouchableOpacity>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>—</Text>
      ) : (
        rows.slice(0, 12).map((r) => (
          <View key={r.id} style={styles.rowItem}>
            <Text style={styles.rowTx}>{rowLine(r)}</Text>
            {onLink &&
            kindsForLink?.includes(r.kind) &&
            linkLabel &&
            (r.kind === "vet_visit" || r.kind === "treatment") ? (
              <TouchableOpacity onPress={() => onLink(r.id)}>
                <Text style={styles.linkTx}>{linkLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}
    </View>
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
  alert: {
    ...mobileTypography.meta,
    color: mobileColors.warning
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
  section: { marginTop: mobileSpacing.md },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  addTx: { fontSize: 22, fontWeight: "700", color: mobileColors.success },
  empty: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowTx: { flex: 1, ...mobileTypography.body, fontSize: 14 },
  linkTx: { color: mobileColors.accent, fontWeight: "600", fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: mobileColors.background,
    padding: mobileSpacing.lg,
    borderTopLeftRadius: mobileRadius.lg,
    borderTopRightRadius: mobileRadius.lg,
    maxHeight: "88%"
  },
  modalTitle: {
    ...mobileTypography.cardTitle,
    marginBottom: mobileSpacing.md
  },
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
