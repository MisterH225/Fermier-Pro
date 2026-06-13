import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AppTextField } from "../../common/AppTextField";
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
import { useModal } from "../../modals/useModal";
import { AppDatePicker } from "../../common/AppDatePicker";
import { fetchFarmAnimals, postAnimalWeight } from "../../../lib/api";
import { toIsoDateString } from "../../../lib/appDate";
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
import { getQueryErrorMessage, getUserFacingError } from "../../../lib/userFacingError";

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
  const [measuredAtIso, setMeasuredAtIso] = useState(() => toIsoDateString(new Date()));
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
    return {
      animalId,
      weightKg: w,
      measuredAt: measuredAtIso.trim() || undefined,
      note: note.trim() || undefined
    };
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
        {
          weightKg: p.weightKg,
          measuredAt: p.measuredAt,
          note: p.note
        },
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
            body: {
              weightKg: p.weightKg,
              measuredAt: p.measuredAt,
              note: p.note
            }
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
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
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
            <ActivityIndicator color={mobileColors.onAccent} />
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
        <AppTextField
          label={t("cheptel.weight.weightKg")}
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
        />
        <AppDatePicker
          farmId={farmId}
          isoValue={measuredAtIso}
          onIsoChange={setMeasuredAtIso}
          label={t("cheptel.weight.measuredAt")}
          maxDate={new Date()}
        />
        <AppTextField
          label={t("cheptel.weight.note")}
          value={note}
          onChangeText={setNote}
        />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: { ...mobileTypography.meta, fontWeight: "600" },
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
  primaryTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
