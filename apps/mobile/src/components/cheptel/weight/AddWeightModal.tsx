import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
import { useModal } from "../../modals/useModal";
import { fetchFarmAnimals, postAnimalWeight } from "../../../lib/api";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../../../hooks/useOfflineMutation";
import { optimisticAnimalWeight } from "../../../lib/offline/optimistic";
import { isOfflineQueuedResult } from "../../../lib/offline/types";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  preselectedAnimalId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function AddWeightModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  preselectedAnimalId,
  onClose,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const qc = useQueryClient();
  const [animalId, setAnimalId] = useState(preselectedAnimalId ?? "");
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: visible
  });

  const buildWeightPayload = () => {
    const w = Number.parseFloat(weightKg.replace(",", "."));
    if (!animalId || !Number.isFinite(w) || w <= 0) {
      throw new Error(t("cheptel.weight.invalid"));
    }
    return { animalId, weightKg: w, note: note.trim() || undefined };
  };

  const saveMut = useOfflineMutation({
    farmId,
    type: "cheptel.postWeight",
    label: t("cheptel.weight.addTitle"),
    mutationFn: async () => {
      const p = buildWeightPayload();
      return postAnimalWeight(
        accessToken,
        farmId,
        p.animalId,
        { weightKg: p.weightKg, note: p.note },
        activeProfileId
      );
    },
    buildOfflineItem: () => {
      const p = buildWeightPayload();
      return {
        calls: [
          {
            method: "POST",
            path: `/farms/${farmId}/animals/${p.animalId}/weights`,
            body: { weightKg: p.weightKg, note: p.note }
          }
        ],
        invalidateRoots: [
          "farmAnimals",
          "farmCheptel",
          "cheptelGmq",
          "cheptelWeightSeries"
        ]
      };
    },
    applyOptimistic: () => {
      const p = buildWeightPayload();
      optimisticAnimalWeight(qc, farmId, activeProfileId, p.animalId, p.weightKg);
    },
    onSuccess: (data) => {
      onSaved();
      onClose();
      open("success", {
        message: isOfflineQueuedResult(data)
          ? offlineQueuedMessage(t)
          : t("cheptel.weight.saveSuccess"),
        autoDismissMs: 2200
      });
    },
    onQueued: () => {
      onSaved();
      onClose();
      open("success", {
        message: offlineQueuedMessage(t),
        autoDismissMs: 2600
      });
    },
    onError: (e: Error) => Alert.alert("", e.message)
  });

  const animals = (animalsQuery.data ?? []).filter((a) => a.status === "active");

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.weight.addTitle")}
      footerPrimary={
        <Pressable
          style={styles.primary}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryTx}>{t("cheptel.weight.save")}</Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title={t("modals.sections.animal")}>
        <Text style={styles.label}>{t("cheptel.weight.pickAnimal")}</Text>
        <View style={styles.pillRow}>
          {animals.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.pill, animalId === a.id && styles.pillOn]}
              onPress={() => setAnimalId(a.id)}
            >
              <Text style={[styles.pillTx, animalId === a.id && styles.pillTxOn]}>
                {a.tagCode ?? a.publicId.slice(0, 8)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={t("modals.sections.measurement")}>
        <Text style={styles.label}>{t("cheptel.weight.weightKg")}</Text>
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
        />
        <Text style={styles.label}>{t("cheptel.weight.note")}</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: { ...mobileTypography.meta, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: { borderColor: mobileColors.accent, backgroundColor: mobileColors.accentSoft },
  pillTx: { ...mobileTypography.meta },
  pillTxOn: { color: mobileColors.accent, fontWeight: "700" },
  primary: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryTx: { color: "#fff", fontWeight: "700" }
});
