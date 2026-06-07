import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { SecondaryButton } from "../ui/SecondaryButton";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type ReceiptCondition = "conform" | "minor_issue" | "major_issue";

type Props = {
  visible: boolean;
  submitting?: boolean;
  animalIds: string[];
  priceType: string;
  onClose: () => void;
  onConfirm: (payload: {
    receivedAt: string;
    condition: ReceiptCondition;
    receivedAnimalIds: string[];
    realWeightKg?: number;
    notes?: string;
  }) => void;
};

const CONDITIONS: ReceiptCondition[] = ["conform", "minor_issue", "major_issue"];

export function ConfirmReceiptModal({
  visible,
  submitting,
  animalIds,
  priceType,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [condition, setCondition] = useState<ReceiptCondition>("conform");
  const [notes, setNotes] = useState("");
  const [realWeight, setRealWeight] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(animalIds.map((id) => [id, true]))
  );

  const allChecked = useMemo(
    () => animalIds.length === 0 || animalIds.every((id) => checked[id]),
    [animalIds, checked]
  );
  const canConfirm =
    allChecked &&
    condition === "conform" &&
    (priceType === "flat" ||
      Number.parseFloat(realWeight.replace(",", ".")) > 0);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.receiptModal.title")}
      footerPrimary={
        <View style={{ gap: mobileSpacing.sm }}>
          <PrimaryButton
            label={t("marketScreen.receiptModal.confirm")}
            onPress={() => {
              const kg = Number.parseFloat(realWeight.replace(",", "."));
              onConfirm({
                receivedAt,
                condition,
                receivedAnimalIds: animalIds.filter((id) => checked[id]),
                realWeightKg:
                  priceType !== "flat" && Number.isFinite(kg) ? kg : undefined,
                notes: notes.trim() || undefined
              });
            }}
            loading={submitting}
            disabled={!canConfirm}
          />
          {condition !== "conform" ? (
            <SecondaryButton
              label={t("marketScreen.receiptModal.reportProblem")}
              onPress={() =>
                onConfirm({
                  receivedAt,
                  condition,
                  receivedAnimalIds: animalIds.filter((id) => checked[id]),
                  notes: notes.trim() || undefined
                })
              }
              loading={submitting}
            />
          ) : null}
        </View>
      }
    >
      <Text style={styles.info}>{t("marketScreen.receiptModal.info")}</Text>
      {animalIds.length > 0 ? (
        <View style={styles.checklist}>
          <Text style={styles.label}>{t("marketScreen.receiptModal.animals")}</Text>
          {animalIds.map((id) => (
            <Pressable
              key={id}
              style={styles.checkRow}
              onPress={() =>
                setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
              }
            >
              <Text style={styles.checkMark}>{checked[id] ? "☑" : "☐"}</Text>
              <Text style={styles.checkLabel}>{id.slice(0, 8)}…</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <AppDatePicker
        label={t("marketScreen.receiptModal.date")}
        mode="date"
        isoValue={receivedAt}
        onIsoChange={setReceivedAt}
      />
      <Text style={styles.label}>{t("marketScreen.receiptModal.condition")}</Text>
      <View style={styles.methodRow}>
        {CONDITIONS.map((c) => (
          <Text
            key={c}
            style={[styles.methodChip, condition === c && styles.methodChipOn]}
            onPress={() => setCondition(c)}
          >
            {t(`marketScreen.receiptModal.conditions.${c}`)}
          </Text>
        ))}
      </View>
      {priceType !== "flat" ? (
        <>
          <Text style={styles.label}>
            {t("marketScreen.transaction.realWeight")}
          </Text>
          <TextInput
            style={styles.input}
            value={realWeight}
            onChangeText={setRealWeight}
            keyboardType="decimal-pad"
            placeholder="0,0"
          />
        </>
      ) : null}
      {condition !== "conform" ? (
        <>
          <Text style={styles.label}>{t("marketScreen.receiptModal.comment")}</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={t("marketScreen.receiptModal.commentPh")}
          />
        </>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  info: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 8,
    padding: mobileSpacing.md,
    minHeight: 72,
    textAlignVertical: "top"
  },
  checklist: { marginBottom: mobileSpacing.sm },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  checkMark: { fontSize: 18 },
  checkLabel: { ...mobileTypography.body, color: mobileColors.textPrimary },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  methodChip: {
    ...mobileTypography.meta,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: mobileColors.border,
    color: mobileColors.textSecondary
  },
  methodChipOn: {
    borderColor: mobileColors.accent,
    color: mobileColors.accent,
    backgroundColor: mobileColors.surfaceMuted
  }
});
