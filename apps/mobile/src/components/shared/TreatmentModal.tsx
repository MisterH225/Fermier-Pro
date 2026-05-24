import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { addDiseaseTreatment, type AddDiseaseTreatmentBody } from "../../lib/api";
import { formatAuthError } from "../../lib/authErrors";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  diseaseRecordId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function TreatmentModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  diseaseRecordId,
  onClose,
  onSuccess
}: Props) {
  const { t } = useTranslation();
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDrugName("");
    setDosage("");
    setNotes("");
  }, [visible, diseaseRecordId]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!diseaseRecordId) {
        throw new Error("missing");
      }
      const body: AddDiseaseTreatmentBody = {
        drugName: drugName.trim(),
        dosage: dosage.trim() || undefined,
        notes: notes.trim() || undefined
      };
      return addDiseaseTreatment(
        accessToken,
        farmId,
        diseaseRecordId,
        body,
        activeProfileId
      );
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    }
  });

  const canSubmit = drugName.trim().length > 0 && Boolean(diseaseRecordId);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("health.treatmentModal.title")}
      footerPrimary={
        <Pressable
          style={[styles.primaryBtn, (!canSubmit || saveMut.isPending) && styles.btnDisabled]}
          disabled={!canSubmit || saveMut.isPending}
          onPress={() => saveMut.mutate()}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{t("health.treatmentModal.submit")}</Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title={t("health.treatmentModal.section")}>
        <Text style={styles.label}>{t("health.fieldDrugName")}</Text>
        <TextInput
          style={styles.input}
          value={drugName}
          onChangeText={setDrugName}
          placeholder={t("health.treatmentModal.drugPlaceholder")}
        />
        <Text style={styles.label}>{t("health.fieldDosage")}</Text>
        <TextInput
          style={styles.input}
          value={dosage}
          onChangeText={setDosage}
          placeholder={t("health.treatmentModal.dosagePlaceholder")}
        />
        <Text style={styles.label}>{t("health.fieldNotes")}</Text>
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
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    marginBottom: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
