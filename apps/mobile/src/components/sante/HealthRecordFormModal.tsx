import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FarmHealthEntityType, FarmHealthRecordKind } from "../../lib/api";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import {
  DISEASE_STATUSES,
  MORTALITY_CAUSES
} from "./healthUtils";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

export type HealthFormState = {
  occurredDate: string;
  notes: string;
  vaccineName: string;
  vaccineType: string;
  nextReminderDate: string;
  practitioner: string;
  diagnosis: string;
  caseStatus: (typeof DISEASE_STATUSES)[number];
  vetName: string;
  vetReason: string;
  vetContact: string;
  vetCost: string;
  vetStatus: "planned" | "completed";
  drugName: string;
  dosage: string;
  treatCost: string;
  mortCause: (typeof MORTALITY_CAUSES)[number];
  mortHeads: string;
};

type Props = {
  visible: boolean;
  farmId: string;
  formKind: FarmHealthRecordKind;
  subjectType: FarmHealthEntityType;
  saving: boolean;
  form: HealthFormState;
  onChange: (patch: Partial<HealthFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function HealthRecordFormModal({
  visible,
  farmId,
  formKind,
  subjectType,
  saving,
  form,
  onChange,
  onClose,
  onSubmit
}: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<HealthFormState>) => onChange(patch);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t(`health.formTitles.${formKind}` as const)}
      footerPrimary={
        <View style={styles.modalActions}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>{t("health.cancel")}</Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator color={mobileColors.onAccent} />
            ) : (
              <Text style={styles.saveTx}>{t("health.save")}</Text>
            )}
          </Pressable>
        </View>
      }
    >
      <ModalSection title={t("health.formSectionWhen")}>
        <AppDatePicker
          label={t("health.fieldDate")}
          isoValue={form.occurredDate}
          onIsoChange={(v) => set({ occurredDate: v })}
          farmId={farmId}
          maxDate={new Date()}
        />
      </ModalSection>

      {formKind === "vaccination" ? (
        <ModalSection title={t("health.formSectionVaccine")}>
          <FieldLabel>{t("health.fieldVaccineName")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.vaccineName}
            onChangeText={(v) => set({ vaccineName: v })}
          />
          <FieldLabel>{t("health.fieldVaccineType")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.vaccineType}
            onChangeText={(v) => set({ vaccineType: v })}
          />
          <AppDatePicker
            label={t("health.fieldNextReminder")}
            isoValue={form.nextReminderDate}
            onIsoChange={(v) => set({ nextReminderDate: v })}
            farmId={farmId}
            minDate={new Date()}
          />
          <FieldLabel>{t("health.fieldPractitioner")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.practitioner}
            onChangeText={(v) => set({ practitioner: v })}
          />
        </ModalSection>
      ) : null}

      {formKind === "vet_visit" ? (
        <ModalSection title={t("health.formSectionVet")}>
          <FieldLabel>{t("health.fieldVetStatus")}</FieldLabel>
          <View style={styles.row}>
            {(["completed", "planned"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, form.vetStatus === s && styles.chipOn]}
                onPress={() => set({ vetStatus: s })}
              >
                <Text style={styles.chipTx}>{t(`health.vetStatus.${s}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FieldLabel>{t("health.fieldVetName")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.vetName}
            onChangeText={(v) => set({ vetName: v })}
          />
          <FieldLabel>{t("health.fieldVetReason")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.vetReason}
            onChangeText={(v) => set({ vetReason: v })}
          />
          <FieldLabel>{t("health.fieldVetContact")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.vetContact}
            onChangeText={(v) => set({ vetContact: v })}
          />
          <FieldLabel>{t("health.fieldCost")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.vetCost}
            onChangeText={(v) => set({ vetCost: v })}
            keyboardType="decimal-pad"
          />
        </ModalSection>
      ) : null}

      {formKind === "treatment" ? (
        <ModalSection title={t("health.formSectionTreatment")}>
          <FieldLabel>{t("health.fieldDrugName")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.drugName}
            onChangeText={(v) => set({ drugName: v })}
          />
          <FieldLabel>{t("health.fieldDosage")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.dosage}
            onChangeText={(v) => set({ dosage: v })}
          />
          <FieldLabel>{t("health.fieldCost")}</FieldLabel>
          <TextInput
            style={styles.input}
            value={form.treatCost}
            onChangeText={(v) => set({ treatCost: v })}
            keyboardType="decimal-pad"
          />
        </ModalSection>
      ) : null}

      {formKind === "mortality" ? (
        <ModalSection title={t("health.formSectionMortality")}>
          <FieldLabel>{t("health.fieldMortCause")}</FieldLabel>
          <View style={styles.row}>
            {MORTALITY_CAUSES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, form.mortCause === c && styles.chipOn]}
                onPress={() => set({ mortCause: c })}
              >
                <Text style={styles.chipTx}>
                  {t(`health.mortCause.${c}` as const)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {subjectType === "group" ? (
            <>
              <FieldLabel>{t("health.fieldHeadcount")}</FieldLabel>
              <TextInput
                style={styles.input}
                value={form.mortHeads}
                onChangeText={(v) => set({ mortHeads: v })}
                keyboardType="number-pad"
              />
            </>
          ) : null}
          <Text style={styles.mortHint}>{t("health.mortalityHint")}</Text>
        </ModalSection>
      ) : null}

      <ModalSection title={t("health.formSectionNotes")}>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={form.notes}
          onChangeText={(v) => set({ notes: v })}
          multiline
          placeholder={t("health.fieldNotes")}
        />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}18`
  },
  chipTx: { fontSize: mobileFontSize.sm, color: mobileColors.textPrimary },
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
  saveTx: { color: mobileColors.onAccent, fontWeight: "700" },
  mortHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
