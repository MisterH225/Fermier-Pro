import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  confirmDetectedBatch,
  type DetectedBatchAnimalDto,
  type DetectedBatchDto
} from "../../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";

type Props = {
  visible: boolean;
  batch: DetectedBatchDto | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onConfirmed: () => void;
};

function resolveAnimals(batch: DetectedBatchDto): DetectedBatchAnimalDto[] {
  if (batch.animals && batch.animals.length > 0) {
    return batch.animals;
  }
  return batch.animalIds.map((id) => ({
    id,
    label: id.slice(0, 8),
    ageWeeks: null,
    weightKg: null,
    birthDate: null,
    generationKey: batch.generationKey ?? "unknown",
    generationLabel: batch.generationLabel ?? "—",
    penName: null
  }));
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState(false);

  useEffect(() => {
    if (!batch || !visible) {
      return;
    }
    setName(batch.name);
    setSelectedIds(new Set(batch.animalIds));
    setSplitMode(false);
  }, [batch, visible]);

  const animals = useMemo(
    () => (batch ? resolveAnimals(batch) : []),
    [batch]
  );

  const generationGroups = useMemo(() => {
    const map = new Map<string, DetectedBatchAnimalDto[]>();
    for (const a of animals) {
      if (!selectedIds.has(a.id)) {
        continue;
      }
      const key = a.generationKey || "unknown";
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return [...map.entries()].map(([key, members]) => ({
      key,
      label: members[0]?.generationLabel ?? key,
      members
    }));
  }, [animals, selectedIds]);

  const selectedCount = selectedIds.size;
  const canConfirm = selectedCount >= 1 && name.trim().length > 0;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["detectedBatches", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmBatches", farmId] });
    void qc.invalidateQueries({ queryKey: ["batchProfitability", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!batch) {
        throw new Error("missing batch");
      }
      const animalIds = [...selectedIds];
      if (animalIds.length < 1) {
        throw new Error(t("cheptel.batches.editNeedAnimals"));
      }
      return confirmDetectedBatch(
        accessToken,
        farmId,
        {
          name: name.trim() || batch.name,
          category: batch.category as "starter" | "fattening",
          animalIds
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      invalidate();
      onConfirmed();
      onClose();
    }
  });

  const splitMutation = useMutation({
    mutationFn: async () => {
      if (!batch) {
        throw new Error("missing batch");
      }
      const groups = generationGroups.filter((g) => g.members.length >= 1);
      if (groups.length < 1) {
        throw new Error(t("cheptel.batches.editNeedAnimals"));
      }
      const catLabel = batch.category === "fattening" ? "Eng" : "Dem";
      const results = [];
      for (const g of groups) {
        const batchName =
          groups.length === 1
            ? name.trim() || batch.name
            : `Bande ${catLabel}-${g.label}`;
        results.push(
          await confirmDetectedBatch(
            accessToken,
            farmId,
            {
              name: batchName,
              category: batch.category as "starter" | "fattening",
              animalIds: g.members.map((m) => m.id)
            },
            activeProfileId
          )
        );
      }
      return results;
    },
    onSuccess: () => {
      invalidate();
      onConfirmed();
      onClose();
    }
  });

  if (!batch) {
    return null;
  }

  const busy = mutation.isPending || splitMutation.isPending;
  const error =
    (mutation.error as Error | null)?.message ||
    (splitMutation.error as Error | null)?.message;
  const hasMultipleGenerations = generationGroups.length > 1;

  const toggleAnimal = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(animals.map((a) => a.id)));
  const selectNone = () => setSelectedIds(new Set());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.kav} behavior="padding" keyboardVerticalOffset={0}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{t("cheptel.batches.editTitle")}</Text>
            <Text style={styles.body}>{t("cheptel.batches.editBody")}</Text>

            <Text style={styles.label}>{t("cheptel.batches.confirmName")}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={batch.name}
            />

            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {selectedCount}/{animals.length} {t("health.diseases.unitSubjects")}
                {batch.generationLabel
                  ? ` · ${t("cheptel.batches.generation")}: ${batch.generationLabel}`
                  : ""}
              </Text>
              <View style={styles.selectActions}>
                <Pressable onPress={selectAll} hitSlop={8}>
                  <Text style={styles.linkTx}>{t("cheptel.batches.selectAll")}</Text>
                </Pressable>
                <Pressable onPress={selectNone} hitSlop={8}>
                  <Text style={styles.linkTx}>{t("cheptel.batches.selectNone")}</Text>
                </Pressable>
              </View>
            </View>

            {hasMultipleGenerations ? (
              <Pressable
                style={styles.splitHint}
                onPress={() => setSplitMode((v) => !v)}
              >
                <Text style={styles.splitHintTx}>
                  {splitMode
                    ? t("cheptel.batches.splitModeOff")
                    : t("cheptel.batches.splitModeOn", {
                        count: generationGroups.length
                      })}
                </Text>
              </Pressable>
            ) : null}

            <ScrollView style={styles.list} nestedScrollEnabled>
              {animals.map((a) => {
                const on = selectedIds.has(a.id);
                return (
                  <Pressable
                    key={a.id}
                    style={[styles.animalRow, on && styles.animalRowOn]}
                    onPress={() => toggleAnimal(a.id)}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <View style={styles.animalInfo}>
                      <Text style={styles.animalLabel}>{a.label}</Text>
                      <Text style={styles.animalMeta}>
                        {a.generationLabel}
                        {a.ageWeeks != null
                          ? ` · ${a.ageWeeks} ${t("cheptel.weight.weeksAbbr")}`
                          : ""}
                        {a.weightKg != null ? ` · ${a.weightKg} kg` : ""}
                        {a.penName ? ` · ${a.penName}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onClose} disabled={busy}>
                <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
              </Pressable>
              {splitMode && hasMultipleGenerations ? (
                <Pressable
                  style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
                  onPress={() => splitMutation.mutate()}
                  disabled={busy || !canConfirm}
                >
                  {busy ? (
                    <ActivityIndicator color={mobileColors.onAccent} />
                  ) : (
                    <Text style={styles.confirmTx}>
                      {t("cheptel.batches.confirmSplitAction", {
                        count: generationGroups.length
                      })}
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
                  onPress={() => mutation.mutate()}
                  disabled={busy || !canConfirm}
                >
                  {busy ? (
                    <ActivityIndicator color={mobileColors.onAccent} />
                  ) : (
                    <Text style={styles.confirmTx}>
                      {t("cheptel.batches.confirmAction")}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: mobileSpacing.lg
  },
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    maxHeight: "88%"
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
  metaRow: {
    marginTop: mobileSpacing.sm,
    gap: mobileSpacing.xs
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  selectActions: {
    flexDirection: "row",
    gap: mobileSpacing.md
  },
  linkTx: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: mobileFontSize.sm
  },
  splitHint: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft
  },
  splitHintTx: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: mobileFontSize.sm
  },
  list: {
    marginTop: mobileSpacing.sm,
    maxHeight: 280
  },
  animalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    marginBottom: 6
  },
  animalRowOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: mobileRadius.sm,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  checkOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accent
  },
  checkMark: {
    color: mobileColors.onAccent,
    fontSize: mobileFontSize.sm,
    fontWeight: "700"
  },
  animalInfo: { flex: 1 },
  animalLabel: { fontWeight: "700", color: mobileColors.textPrimary },
  animalMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  error: { color: mobileColors.error, marginTop: mobileSpacing.sm },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
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
  confirmBtnDisabled: { opacity: 0.45 },
  confirmTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
