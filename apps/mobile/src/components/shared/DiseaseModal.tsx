import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { useModal } from "../modals/useModal";
import type {
  AnimalListItem,
  BatchListItem,
  CreateDiseaseCaseBody,
  FarmHealthEntityType
} from "../../lib/api";
import {
  createFarmDiseaseCase,
  fetchCheptelPens,
  postPenMove,
  updateFarmDiseaseCase,
  type FarmHealthRecordRowDto
} from "../../lib/api";
import { formatAuthError } from "../../lib/authErrors";
import {
  offlineAwareMessage,
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";
import { HealthSubjectPicker } from "../sante/HealthSubjectPicker";
import { animalDisplayTag } from "../cheptel/animals/animalUtils";
import { toIsoDate } from "../sante/healthUtils";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export const DISEASE_SYMPTOM_TAGS = [
  "Fièvre",
  "Toux",
  "Diarrhée",
  "Perte d'appétit",
  "Abattement",
  "Boiterie",
  "Vomissements",
  "Troubles respiratoires",
  "Lésions cutanées",
  "Amaigrissement",
  "Tremblements",
  "Autre"
] as const;

export const DISEASE_DURATION_OPTIONS = [
  "Moins de 24h",
  "1-2 jours",
  "3-5 jours",
  "1 semaine",
  "Plus d'une semaine"
] as const;

export type DiseaseSeverityKey = "mild" | "moderate" | "severe";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  /** Pré-rempli depuis Cheptel — sujet verrouillé */
  presetAnimal?: AnimalListItem | null;
  /** Mode édition d'un cas existant */
  editRecord?: FarmHealthRecordRowDto | null;
  livestockMode?: "individual" | "batch" | "hybrid";
  animals?: AnimalListItem[];
  batches?: BatchListItem[];
  onClose: () => void;
  onSuccess: () => void;
};

function todayIso(): string {
  return toIsoDate(new Date());
}

export function DiseaseModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  presetAnimal,
  editRecord,
  livestockMode = "individual",
  animals = [],
  batches = [],
  onClose,
  onSuccess
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const locked = Boolean(presetAnimal) || Boolean(editRecord);
  const isEdit = Boolean(editRecord);

  const [subjectType, setSubjectType] = useState<FarmHealthEntityType>("animal");
  const [subjectId, setSubjectId] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [durationEstimate, setDurationEstimate] = useState<string>(
    DISEASE_DURATION_OPTIONS[0]
  );
  const [estimatedOnsetDate, setEstimatedOnsetDate] = useState(todayIso());
  const [diagnosis, setDiagnosis] = useState("");
  const [severity, setSeverity] = useState<DiseaseSeverityKey>("moderate");
  const [treatmentOngoing, setTreatmentOngoing] = useState(false);
  const [treatmentNotes, setTreatmentNotes] = useState("");
  const [inIsolation, setInIsolation] = useState(false);
  const [showIsolationPicker, setShowIsolationPicker] = useState(false);
  const [isolationPenId, setIsolationPenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const pensQ = useQuery({
    queryKey: ["cheptelPens", farmId, activeProfileId],
    queryFn: () => fetchCheptelPens(accessToken, farmId, activeProfileId),
    enabled: visible && inIsolation && showIsolationPicker
  });

  const quarantinePens = useMemo(
    () =>
      (pensQ.data?.pens ?? []).filter(
        (p) => p.category === "quarantine" && p.isActive
      ),
    [pensQ.data?.pens]
  );

  const firstAnimalId = animals[0]?.id ?? null;
  const firstBatchId = batches[0]?.id ?? null;

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (editRecord) {
      const tags =
        (editRecord.disease?.symptoms as { tags?: string[] } | null)?.tags ?? [];
      setSubjectType(editRecord.entityType);
      setSubjectId(editRecord.entityId);
      setSymptoms(tags);
      setCustomSymptom("");
      setDurationEstimate(
        editRecord.disease?.durationEstimate ?? DISEASE_DURATION_OPTIONS[0]
      );
      setEstimatedOnsetDate(toIsoDate(new Date(editRecord.occurredAt)));
      setDiagnosis(editRecord.disease?.diagnosis ?? "");
      setSeverity((editRecord.disease?.severity as DiseaseSeverityKey) ?? "moderate");
      setTreatmentOngoing(editRecord.disease?.treatmentOngoing === true);
      setTreatmentNotes("");
      setInIsolation(editRecord.disease?.inIsolation === true);
      setShowIsolationPicker(false);
      setIsolationPenId(null);
      setNotes(editRecord.notes ?? "");
      return;
    }
    if (presetAnimal) {
      setSubjectType("animal");
      setSubjectId(presetAnimal.id);
    } else if (firstAnimalId) {
      setSubjectType("animal");
      setSubjectId(firstAnimalId);
    } else if (firstBatchId) {
      setSubjectType("group");
      setSubjectId(firstBatchId);
    }
    setSymptoms([]);
    setCustomSymptom("");
    setDurationEstimate(DISEASE_DURATION_OPTIONS[0]);
    setEstimatedOnsetDate(todayIso());
    setDiagnosis("");
    setSeverity("moderate");
    setTreatmentOngoing(false);
    setTreatmentNotes("");
    setInIsolation(false);
    setShowIsolationPicker(false);
    setIsolationPenId(null);
    setNotes("");
    // Dépendre des IDs (strings stables) plutôt que des références d'arrays
    // recréées à chaque render parent (`?? []`, `.filter()` → boucle infinie).
  }, [visible, presetAnimal, editRecord, firstAnimalId, firstBatchId]);

  const toggleSymptom = (tag: string) => {
    setSymptoms((prev) =>
      prev.includes(tag) ? prev.filter((s) => s !== tag) : [...prev, tag]
    );
  };

  const addCustomSymptom = () => {
    const v = customSymptom.trim();
    if (!v) {
      return;
    }
    setSymptoms((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCustomSymptom("");
  };

  const canSubmit = symptoms.length > 0 && subjectId.trim().length > 0;

  const buildEditBody = () => ({
    symptoms,
    durationEstimate,
    diagnosis: diagnosis.trim() || undefined,
    severity,
    treatmentOngoing,
    inIsolation,
    notes: notes.trim() || undefined
  });

  const buildCreateBody = (): CreateDiseaseCaseBody => ({
    entityType: subjectType,
    entityId: subjectId.trim(),
    symptoms,
    durationEstimate,
    estimatedOnsetDate: `${estimatedOnsetDate.trim()}T12:00:00.000Z`,
    diagnosis: diagnosis.trim() || undefined,
    severity,
    treatmentOngoing,
    treatmentNotes: treatmentOngoing ? treatmentNotes.trim() || undefined : undefined,
    inIsolation,
    isolationPenId: isolationPenId ?? undefined,
    notes: notes.trim() || undefined
  });

  const saveMut = useOfflineMutation({
    farmId,
    type: isEdit ? "health.updateDisease" : "health.createDisease",
    label: t("health.diseaseModal.title"),
    assignLocalEntityId: !isEdit,
    mutationFn: async () => {
      if (!canSubmit) {
        throw new Error(t("health.diseaseModal.validation"));
      }
      if (isEdit && editRecord) {
        return updateFarmDiseaseCase(
          accessToken,
          farmId,
          editRecord.id,
          buildEditBody(),
          activeProfileId
        );
      }
      const body = buildCreateBody();
      const record = await createFarmDiseaseCase(
        accessToken,
        farmId,
        body,
        activeProfileId
      );
      if (
        inIsolation &&
        isolationPenId &&
        subjectType === "animal" &&
        presetAnimal
      ) {
        await postPenMove(
          accessToken,
          farmId,
          {
            toPenId: isolationPenId,
            animalId: subjectId,
            note: t("health.diseaseModal.isolationMoveNote")
          },
          activeProfileId
        );
      }
      return record;
    },
    buildOfflineItem: () => {
      if (!canSubmit) {
        throw new Error(t("health.diseaseModal.validation"));
      }
      if (isEdit && editRecord) {
        return {
          calls: [
            {
              method: "PATCH",
              path: `/farms/${farmId}/health/events/${editRecord.id}/disease`,
              body: buildEditBody()
            }
          ],
          invalidateRoots: [
            "farmHealthEvents",
            "farmDiseasesOverview",
            "farmHealthOverview",
            "farmAnimals",
            "cheptelPens"
          ]
        };
      }
      const body = buildCreateBody();
      const calls: Array<{
        method: "POST" | "PATCH";
        path: string;
        body: unknown;
      }> = [
        {
          method: "POST",
          path: `/farms/${farmId}/health/diseases`,
          body
        }
      ];
      if (
        inIsolation &&
        isolationPenId &&
        subjectType === "animal"
      ) {
        calls.push({
          method: "POST",
          path: `/farms/${farmId}/pen-move`,
          body: {
            toPenId: isolationPenId,
            animalId: subjectId.trim(),
            note: t("health.diseaseModal.isolationMoveNote")
          }
        });
      }
      return {
        calls,
        invalidateRoots: [
          "farmHealthEvents",
          "farmDiseasesOverview",
          "farmHealthOverview",
          "farmAnimals",
          "cheptelPens",
          "farmBarnDetails"
        ]
      };
    },
    onSuccess: (data) => {
      onSuccess();
      onClose();
      open("success", {
        message: offlineAwareMessage(t, data, "health.diseaseModal.success"),
        autoDismissMs: 2800
      });
    },
    onQueued: () => {
      onSuccess();
      onClose();
      open("success", {
        message: offlineQueuedMessage(t),
        autoDismissMs: 2800
      });
    },
    onError: (e: unknown) => {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    }
  });

  const presetSubtitle = presetAnimal
    ? `${animalDisplayTag(presetAnimal)} · ${presetAnimal.breed?.name ?? "—"} · ${presetAnimal.currentPen?.penName ?? "—"}`
    : null;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      dismissible={false}
      title={
        isEdit ? t("health.diseaseModal.editTitle") : t("health.diseaseModal.title")
      }
      footerPrimary={
        <View style={styles.footer}>
          <Pressable style={styles.outlineBtn} onPress={onClose}>
            <Text style={styles.outlineBtnText}>{t("cheptel.cancel")}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryBtn,
              (!canSubmit || saveMut.isPending) && styles.btnDisabled
            ]}
            disabled={!canSubmit || saveMut.isPending}
            onPress={() => saveMut.mutate()}
          >
            {saveMut.isPending ? (
              <ActivityIndicator color={mobileColors.onAccent} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isEdit
                  ? t("health.diseaseModal.saveEdit")
                  : t("health.diseaseModal.submit")}
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
      {presetSubtitle ? (
        <Text style={styles.subtitle}>{presetSubtitle}</Text>
      ) : null}

      <ModalSection title={t("health.diseaseModal.subject")}>
        {locked && presetAnimal ? (
          <Text style={styles.readonly}>{presetSubtitle}</Text>
        ) : (
          <HealthSubjectPicker
            livestockMode={livestockMode}
            animals={animals}
            batches={batches}
            subjectType={subjectType}
            subjectId={subjectId}
            onSelect={(type, id) => {
              setSubjectType(type);
              setSubjectId(id);
            }}
            labels={{
              title: t("health.subjectTitle"),
              modeHint: t(`health.modeHint.${livestockMode}` as const),
              pickAnimal: t("health.pickAnimal"),
              pickBatch: t("health.pickBatch")
            }}
          />
        )}
      </ModalSection>

      <ModalSection title={`${t("health.diseaseModal.symptoms")} *`}>
        <View style={styles.tagGrid}>
          {DISEASE_SYMPTOM_TAGS.map((tag) => {
            const on = symptoms.includes(tag);
            return (
              <Pressable
                key={tag}
                style={[styles.tag, on && styles.tagOn]}
                onPress={() => toggleSymptom(tag)}
              >
                <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.customRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={customSymptom}
            onChangeText={setCustomSymptom}
            placeholder={t("health.diseaseModal.customSymptom")}
          />
          <Pressable style={styles.addBtn} onPress={addCustomSymptom}>
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>
      </ModalSection>

      <ModalSection title={`${t("health.diseaseModal.duration")} *`}>
        <View style={styles.tagGrid}>
          {DISEASE_DURATION_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.tag, durationEstimate === opt && styles.tagOn]}
              onPress={() => setDurationEstimate(opt)}
            >
              <Text
                style={[
                  styles.tagText,
                  durationEstimate === opt && styles.tagTextOn
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={`${t("health.diseaseModal.onsetDate")} *`}>
        <AppDatePicker
          isoValue={estimatedOnsetDate}
          onIsoChange={setEstimatedOnsetDate}
          farmId={farmId}
          maxDate={new Date()}
          required
        />
      </ModalSection>

      <ModalSection title={t("health.diseaseModal.diagnosis")}>
        <TextInput
          style={styles.input}
          value={diagnosis}
          onChangeText={setDiagnosis}
          placeholder={t("health.diseaseModal.diagnosisPlaceholder")}
        />
      </ModalSection>

      <ModalSection title={`${t("health.diseaseModal.severity")} *`}>
        <View style={styles.severityRow}>
          {(
            [
              { key: "mild", label: t("health.diseaseModal.severityMild"), color: "#22C55E" },
              { key: "moderate", label: t("health.diseaseModal.severityModerate"), color: "#F97316" },
              { key: "severe", label: t("health.diseaseModal.severitySevere"), color: "#DC2626" }
            ] as const
          ).map((s) => (
            <Pressable
              key={s.key}
              style={[
                styles.severityPill,
                severity === s.key && { borderColor: s.color, backgroundColor: `${s.color}18` }
              ]}
              onPress={() => setSeverity(s.key)}
            >
              <Text style={[styles.severityText, severity === s.key && { color: s.color }]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={t("health.diseaseModal.treatment")}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("health.diseaseModal.treatmentOngoing")}</Text>
          <Switch value={treatmentOngoing} onValueChange={setTreatmentOngoing} />
        </View>
        {treatmentOngoing ? (
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={treatmentNotes}
            onChangeText={setTreatmentNotes}
            placeholder={t("health.diseaseModal.treatmentPlaceholder")}
            multiline
          />
        ) : null}
      </ModalSection>

      <ModalSection title={t("health.diseaseModal.isolation")}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("health.diseaseModal.isolationToggle")}</Text>
          <Switch
            value={inIsolation}
            onValueChange={(v) => {
              setInIsolation(v);
              if (v) {
                setShowIsolationPicker(true);
              } else {
                setShowIsolationPicker(false);
                setIsolationPenId(null);
              }
            }}
          />
        </View>
        <Text style={styles.hint}>{t("health.diseaseModal.isolationHint")}</Text>
        {inIsolation && showIsolationPicker ? (
          <View style={styles.isolationBox}>
            <Text style={styles.isolationQuestion}>
              {t("health.diseaseModal.isolationQuestion")}
            </Text>
            {quarantinePens.length === 0 ? (
              <Text style={styles.hint}>{t("health.diseaseModal.noQuarantinePen")}</Text>
            ) : (
              quarantinePens.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.penChip,
                    isolationPenId === p.id && styles.penChipOn
                  ]}
                  onPress={() => setIsolationPenId(p.id)}
                >
                  <Text style={styles.penChipText}>
                    {p.code?.trim() || p.name} ({p.occupancy}/{p.capacity})
                  </Text>
                </Pressable>
              ))
            )}
            <Pressable
              style={styles.textLink}
              onPress={() => setShowIsolationPicker(false)}
            >
              <Text style={styles.textLinkText}>
                {t("health.diseaseModal.isolationSkip")}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ModalSection>

      <ModalSection title={t("modals.sections.note")}>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  readonly: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  tagOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  tagText: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  tagTextOn: { color: mobileColors.accent, fontWeight: "700" },
  customRow: { flexDirection: "row", gap: 8, marginTop: mobileSpacing.sm },
  addBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accent
  },
  addBtnText: { color: mobileColors.onAccent, fontSize: 22, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  severityRow: { flexDirection: "row", gap: 8 },
  severityPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center"
  },
  severityText: { ...mobileTypography.meta, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.sm
  },
  switchLabel: { ...mobileTypography.body, flex: 1, paddingRight: mobileSpacing.sm },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  isolationBox: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft,
    gap: 8
  },
  isolationQuestion: { ...mobileTypography.body, fontWeight: "600" },
  penChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  penChipOn: { borderColor: mobileColors.accent, backgroundColor: mobileColors.background },
  penChipText: { ...mobileTypography.body, fontWeight: "600" },
  textLink: { alignSelf: "flex-start", marginTop: 4 },
  textLinkText: { color: mobileColors.accent, fontWeight: "600" },
  footer: { flexDirection: "row", gap: mobileSpacing.sm },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  outlineBtnText: { fontWeight: "600", color: mobileColors.textPrimary },
  primaryBtn: {
    flex: 1.4,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 16 }
});
