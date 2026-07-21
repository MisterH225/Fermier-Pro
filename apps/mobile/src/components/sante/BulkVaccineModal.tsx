import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import {
  createFarmVaccineRecords,
  type VaccineCatalogItemDto,
  type VaccineSubjectRowDto
} from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import {
  isOfflineQueuedResult,
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";

type Props = {
  visible: boolean;
  onClose: () => void;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  vaccine: VaccineCatalogItemDto;
  initialSubjects: VaccineSubjectRowDto[];
  onSuccess: (count: number) => void;
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function BulkVaccineModal({
  visible,
  onClose,
  farmId,
  accessToken,
  activeProfileId,
  vaccine,
  initialSubjects,
  onSuccess
}: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [administeredDate, setAdministeredDate] = useState(() =>
    toIsoDate(new Date())
  );
  const [practitioner, setPractitioner] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible) {
      setSelected(new Set(initialSubjects.map((s) => s.entityId)));
      setAdministeredDate(toIsoDate(new Date()));
      setPractitioner("");
      setBatchNumber("");
      setExpiryDate("");
      setNotes("");
    }
  }, [visible, initialSubjects]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const buildBody = () => ({
    vaccineId: vaccine.id,
    subjects: initialSubjects
      .filter((s) => selected.has(s.entityId))
      .map((s) => ({
        entityType: s.entityType,
        entityId: s.entityId
      })),
    administeredDate: `${administeredDate}T12:00:00.000Z`,
    practitioner: practitioner.trim() || undefined,
    batchNumber: batchNumber.trim() || undefined,
    expiryDate: expiryDate.trim()
      ? `${expiryDate.trim()}T12:00:00.000Z`
      : undefined,
    notes: notes.trim() || undefined
  });

  const mut = useOfflineMutation({
    farmId,
    type: "health.bulkVaccine",
    label: vaccine.name,
    mutationFn: async () =>
      createFarmVaccineRecords(
        accessToken,
        farmId,
        buildBody(),
        activeProfileId
      ),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/vaccines/records`,
          body: buildBody()
        }
      ],
      invalidateRoots: [
        "farmHealthEvents",
        "farmHealthOverview",
        "farmVaccineCoverage",
        "farmAnimals",
        "farmBatches"
      ]
    }),
    onSuccess: (res) => {
      if (isOfflineQueuedResult(res)) {
        return;
      }
      const row = res as { createdCount: number };
      onSuccess(row.createdCount);
      onClose();
    },
    onQueued: () => {
      onSuccess(selected.size);
      onClose();
      Alert.alert(t("common.infoTitle"), offlineQueuedMessage(t));
    },
    onError: (e: Error) =>
      Alert.alert(t("health.errorTitle"), getUserFacingError(e, t))
  });

  const canSubmit = selected.size > 0 && administeredDate.trim().length >= 8;

  const footer = useMemo(
    () => (
      <View style={styles.actions}>
        <Pressable onPress={onClose}>
          <Text style={styles.cancel}>{t("health.cancel")}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, !canSubmit && styles.saveDisabled]}
          disabled={!canSubmit || mut.isPending}
          onPress={() => mut.mutate()}
        >
          {mut.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.saveTx}>{t("health.vaccines.bulkSave")}</Text>
          )}
        </Pressable>
      </View>
    ),
    [canSubmit, mut.isPending, onClose, t]
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("health.vaccines.bulkTitle")}
      footerPrimary={footer}
      sheetMaxHeight="92%"
    >
      <Text style={styles.vaccineName}>{vaccine.icon} {vaccine.name}</Text>
      <Text style={styles.lab}>{t("health.vaccines.bulkSubjects")}</Text>
      <ScrollView style={styles.subjectList} nestedScrollEnabled>
        {initialSubjects.map((s) => {
          const on = selected.has(s.entityId);
          return (
            <Pressable
              key={s.entityId}
              style={[styles.subjectRow, on && styles.subjectOn]}
              onPress={() => toggle(s.entityId)}
            >
              <Text style={styles.subjectTitle}>{s.label}</Text>
              <Text style={styles.subjectMeta}>
                {s.categoryLabel}
                {s.penLabel ? ` · ${s.penLabel}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <AppDatePicker
        label={t("health.fieldDate")}
        isoValue={administeredDate}
        onIsoChange={setAdministeredDate}
        farmId={farmId}
        maxDate={new Date()}
      />
      <Text style={styles.lab}>{t("health.fieldPractitioner")}</Text>
      <TextInput
        style={styles.input}
        value={practitioner}
        onChangeText={setPractitioner}
      />
      <Text style={styles.lab}>{t("health.vaccines.batchNumber")}</Text>
      <TextInput
        style={styles.input}
        value={batchNumber}
        onChangeText={setBatchNumber}
      />
      <AppDatePicker
        label={t("health.vaccines.expiryDate")}
        isoValue={expiryDate}
        onIsoChange={setExpiryDate}
        farmId={farmId}
        minDate={new Date()}
      />
      <Text style={styles.lab}>{t("health.fieldNotes")}</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  vaccineName: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4,
    marginTop: mobileSpacing.sm
  },
  subjectList: { maxHeight: 160, marginBottom: mobileSpacing.sm },
  subjectRow: {
    padding: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    marginBottom: mobileSpacing.xs
  },
  subjectOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}12`
  },
  subjectTitle: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  subjectMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  notes: { minHeight: 72, textAlignVertical: "top" },
  actions: {
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
  saveDisabled: { opacity: 0.5 },
  saveTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
