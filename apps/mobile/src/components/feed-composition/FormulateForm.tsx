import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ProductionStage } from "../../lib/api/feed-composition";
import {
  PRODUCTION_STAGES,
  stageLabelFr
} from "../../lib/feedCompositionFormat";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

export type FormulateFormValues = {
  stage: ProductionStage;
  animalCount: string;
  avgWeightKg: string;
  avgAgeWeeks: string;
  durationDays: string;
};

type Props = {
  values: FormulateFormValues;
  onChange: (next: FormulateFormValues) => void;
  onSubmit: () => void;
  submitting: boolean;
  onFieldFocus?: () => void;
};

export function FormulateForm({
  values,
  onChange,
  onSubmit,
  submitting,
  onFieldFocus
}: Props) {
  return (
    <View style={styles.wrap} testID="formulate-form">
      <Text style={styles.intro}>
        Indiquez pour quels porcs et pour combien de jours. On calcule le
        mélange et le coût.
      </Text>

      <Text style={styles.label}>Pour quels animaux ?</Text>
      <View style={styles.stageGrid}>
        {PRODUCTION_STAGES.map((s) => {
          const selected = values.stage === s;
          return (
            <Pressable
              key={s}
              testID={`stage-${s}`}
              onPress={() => onChange({ ...values, stage: s })}
              style={[styles.stageChip, selected && styles.stageChipOn]}
            >
              <Text
                style={[styles.stageChipText, selected && styles.stageChipTextOn]}
              >
                {stageLabelFr(s)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Field
        label="Combien d’animaux ?"
        value={values.animalCount}
        onChangeText={(animalCount) => onChange({ ...values, animalCount })}
        onFocus={onFieldFocus}
        testID="field-animal-count"
      />
      <Field
        label="Poids moyen (kg)"
        value={values.avgWeightKg}
        onChangeText={(avgWeightKg) => onChange({ ...values, avgWeightKg })}
        onFocus={onFieldFocus}
        testID="field-avg-weight"
      />
      <Field
        label="Âge moyen (semaines) — optionnel"
        value={values.avgAgeWeeks}
        onChangeText={(avgAgeWeeks) => onChange({ ...values, avgAgeWeeks })}
        onFocus={onFieldFocus}
        testID="field-avg-age"
      />
      <Field
        label="Pendant combien de jours ?"
        value={values.durationDays}
        onChangeText={(durationDays) => onChange({ ...values, durationDays })}
        onFocus={onFieldFocus}
        testID="field-duration"
      />

      <Pressable
        style={[styles.submit, submitting && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={submitting}
        testID="formulate-submit"
      >
        <Text style={styles.submitLabel}>
          {submitting ? "Calcul en cours…" : "Calculer mon mélange"}
        </Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  onFocus,
  testID
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onFocus?: () => void;
  testID: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        onFocus={onFocus}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  intro: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  label: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  stageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  stageChip: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: mobileColors.background
  },
  stageChipOn: {
    backgroundColor: mobileColors.accentSoft,
    borderColor: mobileColors.accent
  },
  stageChipText: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  stageChipTextOn: {
    color: mobileColors.accent
  },
  field: { gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  submit: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  submitDisabled: { opacity: 0.6 },
  submitLabel: {
    color: mobileColors.onAccent,
    fontWeight: "800",
    fontSize: mobileFontSize.md
  }
});
