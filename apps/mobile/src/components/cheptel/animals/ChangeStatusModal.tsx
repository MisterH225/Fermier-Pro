import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../../lib/userFacingError";
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
import type { AnimalListItem } from "../../../lib/api";
import { patchCheptelAnimalStatus } from "../../../lib/api";
import { CHEPTEL_ANIMAL_MUTATION_ROOTS } from "../../../lib/cheptelQueries";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../../../hooks/useOfflineMutation";
import { optimisticPatchAnimalStatus } from "../../../lib/offline/optimistic";
import { isOfflineQueuedResult } from "../../../lib/offline/types";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import type { AnimalStatusKey } from "./animalUtils";
import { animalDisplayTag, normalizeAnimalStatusKey } from "./animalUtils";

type Props = {
  visible: boolean;
  animal: AnimalListItem | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  /**
   * Pré-réglage optionnel (verbes P-34). Masque / verrouille le sélecteur de type.
   * Sans preset, le formulaire générique reste inchangé.
   */
  presetStatus?: AnimalStatusKey;
  onClose: () => void;
  onUpdated: () => void;
  onRequestSale?: (animal: AnimalListItem) => void;
  onRequestDisease?: (animal: AnimalListItem) => void;
};

const STATUS_OPTIONS: { key: AnimalStatusKey | "sick"; emoji: string }[] = [
  { key: "active", emoji: "✅" },
  { key: "sick", emoji: "🤒" },
  { key: "dead", emoji: "💀" },
  { key: "sold", emoji: "💰" },
  { key: "exited", emoji: "🚪" },
  { key: "transferred", emoji: "🚚" }
];

export function ChangeStatusModal({
  visible,
  animal,
  farmId,
  accessToken,
  activeProfileId,
  presetStatus,
  onClose,
  onUpdated,
  onRequestSale,
  onRequestDisease
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const qc = useQueryClient();
  const [status, setStatus] = useState<AnimalStatusKey>("active");
  const [note, setNote] = useState("");
  const [deathCause, setDeathCause] = useState("");
  const locked = Boolean(presetStatus);

  useEffect(() => {
    if (visible && animal) {
      if (presetStatus) {
        setStatus(presetStatus);
      } else {
        setStatus(
          (normalizeAnimalStatusKey(animal.status) as AnimalStatusKey) ||
            "active"
        );
      }
      setNote("");
      setDeathCause("");
    }
  }, [visible, animal, presetStatus]);

  const buildPayload = () => {
    if (!animal) {
      throw new Error("Animal manquant");
    }
    if (status === "sold") {
      throw new Error(t("cheptel.animals.sale.useSaleModal"));
    }
    const parts: string[] = [];
    if (status === "dead" && deathCause.trim()) {
      parts.push(`${t("cheptel.animals.status.deathCause")}: ${deathCause}`);
    }
    const mergedNote = [note.trim(), ...parts].filter(Boolean).join(" · ");
    return {
      animalId: animal.id,
      body: {
        status,
        note: mergedNote || null,
        deathCause: status === "dead" ? deathCause.trim() || undefined : undefined
      }
    };
  };

  const saveMut = useOfflineMutation({
    farmId,
    type: "cheptel.patchStatus",
    label: animal ? animalDisplayTag(animal) : "—",
    mutationFn: async () => {
      const { animalId, body } = buildPayload();
      return patchCheptelAnimalStatus(
        accessToken,
        farmId,
        animalId,
        body,
        activeProfileId
      );
    },
    buildOfflineItem: () => {
      const { animalId, body } = buildPayload();
      return {
        calls: [
          {
            method: "PATCH",
            path: `/farms/${farmId}/cheptel/animals/${animalId}/status`,
            body
          }
        ],
        invalidateRoots: [...CHEPTEL_ANIMAL_MUTATION_ROOTS]
      };
    },
    applyOptimistic: () => {
      const { animalId, body } = buildPayload();
      optimisticPatchAnimalStatus(qc, farmId, activeProfileId, animalId, body);
    },
    onSuccess: (data) => {
      onUpdated();
      onClose();
      open("success", {
        message: isOfflineQueuedResult(data)
          ? offlineQueuedMessage(t)
          : t("cheptel.animals.status.success"),
        autoDismissMs: 2200
      });
    },
    onQueued: () => {
      onUpdated();
      onClose();
      open("success", {
        message: offlineQueuedMessage(t),
        autoDismissMs: 2600
      });
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.status.errorTitle"), getUserFacingError(e, t));
    }
  });

  if (!animal) {
    return null;
  }

  const tag = animalDisplayTag(animal);

  const onPickStatus = (key: AnimalStatusKey | "sick") => {
    if (key === "sold") {
      onRequestSale?.(animal);
      onClose();
      return;
    }
    if (key === "sick") {
      onRequestDisease?.(animal);
      onClose();
      return;
    }
    setStatus(key);
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={
        locked
          ? t(`cheptel.animals.status.${status}`, { defaultValue: tag })
          : t("cheptel.animals.status.title", { tag })
      }
      footerPrimary={
        <Pressable
          style={[styles.primaryBtn, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending || status === "sold"}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("cheptel.animals.status.submit")}
            </Text>
          )}
        </Pressable>
      }
    >
      {locked ? (
        <ModalSection title={t("modals.sections.status")}>
          <Text style={styles.hint}>
            {t("cheptel.exits.kindLocked", {
              kind: t(`cheptel.animals.status.${status}`)
            })}
          </Text>
          <Text style={styles.label}>{tag}</Text>
        </ModalSection>
      ) : (
        <ModalSection title={t("modals.sections.status")}>
          <View style={styles.statusGrid}>
            {STATUS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[
                  styles.statusChip,
                  opt.key !== "sold" &&
                    opt.key !== "sick" &&
                    status === opt.key &&
                    styles.statusChipOn
                ]}
                onPress={() => onPickStatus(opt.key)}
              >
                <Text style={styles.statusChipText}>
                  {opt.emoji}{" "}
                  {opt.key === "sick"
                    ? t("cheptel.animals.status.sick")
                    : t(`cheptel.animals.status.${opt.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ModalSection>
      )}

      {status === "dead" ? (
        <ModalSection title={t("cheptel.animals.status.dead")}>
          <Text style={styles.label}>{t("cheptel.animals.status.deathCause")}</Text>
          <TextInput
            style={styles.input}
            value={deathCause}
            onChangeText={setDeathCause}
          />
          <Text style={styles.hint}>{t("cheptel.animals.status.healthLinked")}</Text>
        </ModalSection>
      ) : null}

      {status === "exited" ? (
        <ModalSection title={t("cheptel.animals.status.exited")}>
          <Text style={styles.hint}>{t("cheptel.animals.status.exitedHint")}</Text>
        </ModalSection>
      ) : null}

      <ModalSection title={t("modals.sections.note")}>
        <Text style={styles.label}>{t("cheptel.animals.status.note")}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={note}
          onChangeText={setNote}
          multiline
        />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  statusGrid: { gap: 8 },
  statusChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  statusChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  statusChipText: { ...mobileTypography.body, fontWeight: "600" },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
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
  multiline: { minHeight: 64, textAlignVertical: "top" },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 16 }
});
