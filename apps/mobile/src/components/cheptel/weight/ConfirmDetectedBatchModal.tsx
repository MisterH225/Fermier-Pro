import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { confirmDetectedBatch, type DetectedBatchDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  visible: boolean;
  batch: DetectedBatchDto | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onConfirmed: () => void;
};

export function ConfirmDetectedBatchModal({
  visible,
  batch,
  farmId,
  accessToken,
  activeProfileId,
  onClose,
  onConfirmed
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (!batch) {
        throw new Error("missing batch");
      }
      return confirmDetectedBatch(
        accessToken,
        farmId,
        {
          name: name.trim() || batch.name,
          category: batch.category as "starter" | "fattening",
          animalIds: batch.animalIds
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["detectedBatches", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmBatches", farmId] });
      void qc.invalidateQueries({ queryKey: ["batchProfitability", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
      onConfirmed();
      onClose();
    }
  });

  if (!batch) {
    return null;
  }

  const displayName = name || batch.name;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("cheptel.batches.confirmTitle")}</Text>
          <Text style={styles.body}>{t("cheptel.batches.confirmBody")}</Text>

          <Text style={styles.label}>{t("cheptel.batches.confirmName")}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setName}
            placeholder={batch.name}
          />

          <Text style={styles.meta}>
            {batch.headcount} {t("health.diseases.unitSubjects")}
            {batch.avgAgeWeeks != null
              ? ` · ${batch.avgAgeWeeks} ${t("cheptel.weight.weeksAbbr")}`
              : ""}
          </Text>

          {mutation.isError ? (
            <Text style={styles.error}>
              {(mutation.error as Error).message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              style={styles.confirmBtn}
              onPress={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={mobileColors.onAccent} />
              ) : (
                <Text style={styles.confirmTx}>
                  {t("cheptel.batches.confirmAction")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: mobileSpacing.lg
  },
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg
  },
  title: { ...mobileTypography.title, fontWeight: "700" },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    marginTop: mobileSpacing.md
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  error: { color: mobileColors.error, marginTop: mobileSpacing.sm },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.lg
  },
  cancelBtn: { padding: mobileSpacing.sm },
  cancelTx: { color: mobileColors.textSecondary },
  confirmBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    minWidth: 120,
    alignItems: "center"
  },
  confirmTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
