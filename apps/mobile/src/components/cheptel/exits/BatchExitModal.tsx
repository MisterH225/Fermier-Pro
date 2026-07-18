import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput
} from "react-native";
import { createLivestockExit } from "../../../lib/api/livestockExits";
import { getUserFacingError } from "../../../lib/userFacingError";
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
import { useModal } from "../../modals/useModal";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import {
  LIVESTOCK_EXIT_VERB_KEYS,
  type LivestockExitKind
} from "./livestockExitKind";

type Props = {
  visible: boolean;
  farmId: string;
  batchId: string;
  batchName: string;
  headcount: number;
  accessToken: string;
  activeProfileId?: string | null;
  /** Kind verrouillé (verbe déjà choisi). */
  presetKind: Exclude<LivestockExitKind, "sale"> | "sale";
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Formulaire de sortie bande, kind pré-réglé (équivalent ChangeStatusModal animal).
 * Le sélecteur de type est masqué — l’utilisateur a choisi via le verbe.
 */
export function BatchExitModal({
  visible,
  farmId,
  batchId,
  batchName,
  headcount,
  accessToken,
  activeProfileId,
  presetKind,
  onClose,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const qc = useQueryClient();
  const [headcountAffected, setHeadcountAffected] = useState(String(headcount || 1));
  const [note, setNote] = useState("");
  const [deathCause, setDeathCause] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [price, setPrice] = useState("");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    if (visible) {
      setHeadcountAffected(String(Math.max(1, headcount || 1)));
      setNote("");
      setDeathCause("");
      setBuyerName("");
      setPrice("");
      setDestination("");
    }
  }, [visible, headcount, presetKind]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(headcountAffected, 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(t("cheptel.exits.invalidHeadcount"));
      }
      const priceN = price.trim()
        ? Number.parseFloat(price.replace(",", "."))
        : undefined;
      return createLivestockExit(
        accessToken,
        farmId,
        {
          kind: presetKind,
          batchId,
          headcountAffected: n,
          note: note.trim() || undefined,
          deathCause:
            presetKind === "mortality"
              ? deathCause.trim() || undefined
              : undefined,
          buyerName:
            presetKind === "sale" ? buyerName.trim() || undefined : undefined,
          price:
            presetKind === "sale" && priceN != null && Number.isFinite(priceN)
              ? priceN
              : undefined,
          transferDestination:
            presetKind === "transfer"
              ? destination.trim() || undefined
              : undefined,
          slaughterDestination:
            presetKind === "slaughter"
              ? destination.trim() || undefined
              : undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmBatch", farmId, batchId] });
      void qc.invalidateQueries({ queryKey: ["farmBatches", farmId] });
      onSaved();
      onClose();
      open("success", {
        message: t("cheptel.exits.success"),
        autoDismissMs: 2200
      });
    },
    onError: (e: Error) => {
      Alert.alert(t("common.error"), getUserFacingError(e, t));
    }
  });

  const title = t(LIVESTOCK_EXIT_VERB_KEYS[presetKind].labelKey);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={title}
      footerPrimary={
        <Pressable
          style={[styles.primaryBtn, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
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
      <ModalSection title={t("modals.sections.status")}>
        <Text style={styles.hint}>
          {t("cheptel.exits.kindLocked", { kind: title })}
        </Text>
        <Text style={styles.label}>{batchName}</Text>
      </ModalSection>

      <ModalSection title={t("cheptel.exits.headcount")}>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={headcountAffected}
          onChangeText={setHeadcountAffected}
        />
      </ModalSection>

      {presetKind === "mortality" ? (
        <ModalSection title={t("cheptel.animals.status.deathCause")}>
          <TextInput
            style={styles.input}
            value={deathCause}
            onChangeText={setDeathCause}
          />
        </ModalSection>
      ) : null}

      {presetKind === "sale" ? (
        <ModalSection title={t("cheptel.exits.saleDetails")}>
          <Text style={styles.meta}>{t("cheptel.exits.buyerName")}</Text>
          <TextInput
            style={styles.input}
            value={buyerName}
            onChangeText={setBuyerName}
          />
          <Text style={[styles.meta, { marginTop: 8 }]}>
            {t("cheptel.exits.price")}
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />
        </ModalSection>
      ) : null}

      {presetKind === "transfer" || presetKind === "slaughter" ? (
        <ModalSection title={t("cheptel.exits.destination")}>
          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
          />
        </ModalSection>
      ) : null}

      <ModalSection title={t("modals.sections.note")}>
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
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  label: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: 6
  },
  meta: {
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
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: 16
  }
});
