import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { patchPen, type CheptelPenRowDto } from "../../../lib/api";
import { getUserFacingError } from "../../../lib/userFacingError";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  visible: boolean;
  pen: CheptelPenRowDto | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function EditPenCapacityModal({
  visible,
  pen,
  farmId,
  accessToken,
  activeProfileId,
  onClose,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const [capacity, setCapacity] = useState("");

  useEffect(() => {
    if (visible && pen) {
      setCapacity(pen.capacity > 0 ? String(pen.capacity) : "");
    }
  }, [visible, pen]);

  const parsedCapacity = useMemo(() => {
    const raw = capacity.trim();
    if (!raw) {
      return null;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }, [capacity]);

  const belowOccupancy =
    pen != null &&
    parsedCapacity != null &&
    !Number.isNaN(parsedCapacity) &&
    parsedCapacity > 0 &&
    parsedCapacity < pen.occupancy;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!pen) {
        throw new Error(t("cheptel.pens.editCapacityMissingPen"));
      }
      if (Number.isNaN(parsedCapacity)) {
        throw new Error(t("cheptel.pens.editCapacityInvalid"));
      }
      return patchPen(
        accessToken,
        farmId,
        pen.id,
        { capacity: parsedCapacity },
        activeProfileId
      );
    },
    onSuccess: () => {
      onSaved();
      onClose();
      open("success", {
        message: t("cheptel.pens.editCapacitySuccess"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  if (!pen) {
    return null;
  }

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.pens.editCapacityTitle")}
      statusBadge={{
        label: `${pen.name} · ${pen.barnName}`,
        tone: "neutral"
      }}
      footerPrimary={
        <Pressable
          style={[styles.btn, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.btnText}>{t("cheptel.pens.editCapacitySave")}</Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title={t("cheptel.pens.editCapacitySection")}>
        <Text style={styles.meta}>
          {t("cheptel.pens.capacityLine", {
            occ: pen.occupancy,
            cap: pen.capacity > 0 ? pen.capacity : "—"
          })}
        </Text>
        <Text style={styles.label}>{t("cheptel.pens.capacity")}</Text>
        <TextInput
          style={styles.input}
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
          placeholder={t("cheptel.pens.editCapacityPlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
        />
        <Text style={styles.hint}>{t("cheptel.pens.editCapacityHint")}</Text>
        {belowOccupancy ? (
          <Text style={styles.warn}>
            {t("cheptel.pens.editCapacityBelowOccupancy", {
              occupancy: pen.occupancy
            })}
          </Text>
        ) : null}
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  label: { fontWeight: "600", marginBottom: mobileSpacing.xs },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    fontSize: 16
  },
  hint: {
    marginTop: mobileSpacing.sm,
    fontSize: 12,
    color: mobileColors.textSecondary
  },
  warn: {
    marginTop: mobileSpacing.sm,
    fontSize: 13,
    color: mobileColors.warning,
    fontWeight: "600"
  },
  btn: {
    backgroundColor: mobileColors.accent,
    padding: 14,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: mobileColors.onAccent, fontWeight: "600" }
});
