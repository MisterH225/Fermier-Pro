import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { BaseModal } from "../../modals/BaseModal";
import { useModal } from "../../modals/useModal";
import type { AnimalListItem } from "../../../lib/api";
import { patchCheptelAnimalStatus } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import type { AnimalStatusKey } from "./animalUtils";
import { animalDisplayTag } from "./animalUtils";

type Props = {
  visible: boolean;
  animal: AnimalListItem | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onUpdated: () => void;
};

const STATUS_OPTIONS: { key: AnimalStatusKey; emoji: string }[] = [
  { key: "active", emoji: "✅" },
  { key: "dead", emoji: "💀" },
  { key: "sold", emoji: "💰" },
  { key: "reformed", emoji: "♻️" },
  { key: "transferred", emoji: "🚚" }
];

export function ChangeStatusModal({
  visible,
  animal,
  farmId,
  accessToken,
  activeProfileId,
  onClose,
  onUpdated
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const [status, setStatus] = useState<AnimalStatusKey>("active");
  const [note, setNote] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [buyer, setBuyer] = useState("");
  const [deathCause, setDeathCause] = useState("");

  useEffect(() => {
    if (visible && animal) {
      setStatus((animal.status as AnimalStatusKey) || "active");
      setNote("");
      setSalePrice("");
      setBuyer("");
      setDeathCause("");
    }
  }, [visible, animal]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!animal) {
        throw new Error("Animal manquant");
      }
      const parts: string[] = [];
      if (status === "sold" && salePrice.trim()) {
        parts.push(`${t("cheptel.animals.status.salePrice")}: ${salePrice}`);
      }
      if (status === "sold" && buyer.trim()) {
        parts.push(`${t("cheptel.animals.status.buyer")}: ${buyer}`);
      }
      if (status === "dead" && deathCause.trim()) {
        parts.push(`${t("cheptel.animals.status.deathCause")}: ${deathCause}`);
      }
      const mergedNote = [note.trim(), ...parts].filter(Boolean).join(" · ");
      return patchCheptelAnimalStatus(
        accessToken,
        farmId,
        animal.id,
        {
          status,
          note: mergedNote || null,
          salePrice:
            status === "sold" && salePrice.trim()
              ? Number.parseFloat(salePrice.replace(",", "."))
              : undefined,
          buyerName: status === "sold" ? buyer.trim() || undefined : undefined,
          deathCause: status === "dead" ? deathCause.trim() || undefined : undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      onUpdated();
      onClose();
      open("success", {
        message: t("cheptel.animals.status.success"),
        autoDismissMs: 2200
      });
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.status.errorTitle"), e.message);
    }
  });

  if (!animal) {
    return null;
  }

  const tag = animalDisplayTag(animal);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.animals.status.title", { tag })}
      footerPrimary={
        <Pressable
          style={[styles.primaryBtn, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("cheptel.animals.status.submit")}
            </Text>
          )}
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.statusGrid}>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.statusChip, status === opt.key && styles.statusChipOn]}
              onPress={() => setStatus(opt.key)}
            >
              <Text style={styles.statusChipText}>
                {opt.emoji} {t(`cheptel.animals.status.${opt.key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {status === "sold" ? (
          <>
            <Text style={styles.label}>{t("cheptel.animals.status.salePrice")}</Text>
            <TextInput
              style={styles.input}
              value={salePrice}
              onChangeText={setSalePrice}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>{t("cheptel.animals.status.buyer")}</Text>
            <TextInput style={styles.input} value={buyer} onChangeText={setBuyer} />
            <Text style={styles.hint}>{t("cheptel.animals.status.financeLinked")}</Text>
          </>
        ) : null}

        {status === "dead" ? (
          <>
            <Text style={styles.label}>{t("cheptel.animals.status.deathCause")}</Text>
            <TextInput
              style={styles.input}
              value={deathCause}
              onChangeText={setDeathCause}
            />
            <Text style={styles.hint}>{t("cheptel.animals.status.healthLinked")}</Text>
          </>
        ) : null}

        <Text style={styles.label}>{t("cheptel.animals.status.note")}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={note}
          onChangeText={setNote}
          multiline
        />
      </ScrollView>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: mobileSpacing.sm, paddingBottom: mobileSpacing.lg },
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
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
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
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
