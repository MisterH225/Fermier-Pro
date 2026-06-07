import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import type { AnimalListItem, GestationDetailDto } from "../../lib/api";
import { createGestation } from "../../lib/api";
import { useActiveFarm } from "../../context/ActiveProjectContext";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import {
  isOfflineQueuedResult,
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";

// Les identifiants en base sont des CUID (`@default(cuid())`), pas des UUID.
// On valide donc un identifiant générique : chaîne non vide, sans espace,
// d'une longueur plausible (couvre cuid, cuid2 et uuid).
const ID_RE = /^[a-z0-9_-]{8,}$/i;

function isValidId(value: string | null | undefined): boolean {
  return Boolean(value?.trim() && ID_RE.test(value.trim()));
}

export type CreateGestationModalProps = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  females: AnimalListItem[];
  males: AnimalListItem[];
  /** Truie pré-sélectionnée (depuis Cheptel). */
  presetSowId?: string;
  presetSowLabel?: string;
  penId?: string | null;
  onClose: () => void;
  onCreated?: () => void;
  onSuccess?: (gestation: GestationDetailDto) => void;
};

export function CreateGestationModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  females,
  males,
  presetSowId,
  presetSowLabel,
  onClose,
  onCreated,
  onSuccess
}: CreateGestationModalProps) {
  const { t } = useTranslation();
  const { activeFarmId } = useActiveFarm();
  const resolvedFarmId = isValidId(farmId) ? farmId.trim() : activeFarmId ?? "";
  const lockSow = Boolean(presetSowId?.trim());
  const [sowId, setSowId] = useState("");
  const [boarId, setBoarId] = useState("");
  const [matingDate, setMatingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [matingType, setMatingType] = useState<
    "natural" | "artificial_insemination"
  >("natural");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (presetSowId) {
      setSowId(presetSowId);
    } else {
      setSowId("");
    }
    setBoarId("");
    setMatingDate(new Date().toISOString().slice(0, 10));
    setMatingType("natural");
    setNotes("");
  }, [visible, presetSowId]);

  const sow = useMemo(
    () => females.find((a) => a.id === sowId),
    [females, sowId]
  );

  const sowDisplayLabel =
    presetSowLabel?.trim() ||
    sow?.tagCode?.trim() ||
    (sow ? `FP-${sow.publicId.slice(-6)}` : "");

  const buildBody = () => ({
    sowId,
    boarId: boarId || undefined,
    matingType,
    matingDate,
    notes: notes.trim() || undefined,
    farmId: resolvedFarmId
  });

  const mut = useOfflineMutation({
    farmId: resolvedFarmId,
    type: "gestation.create",
    label: sowDisplayLabel || t("gestationScreen.createTitle"),
    mutationFn: async () =>
      createGestation(
        accessToken,
        resolvedFarmId,
        {
          sowId,
          boarId: boarId || undefined,
          matingType,
          matingDate,
          notes: notes.trim() || undefined
        },
        activeProfileId
      ),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${resolvedFarmId}/gestation/gestations`,
          body: buildBody()
        }
      ],
      invalidateRoots: ["gestation", "dashboardGestations", "farmAnimals"]
    }),
    onSuccess: (gestation) => {
      onCreated?.();
      if (!isOfflineQueuedResult(gestation)) {
        onSuccess?.(gestation as GestationDetailDto);
      }
      onClose();
    },
    onQueued: () => {
      onCreated?.();
      onClose();
      Alert.alert("", offlineQueuedMessage(t));
    },
    onError: (e: Error) => Alert.alert(t("gestationScreen.error"), getUserFacingError(e, t))
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("gestationScreen.createTitle")}
      footerPrimary={
        <Pressable
          style={[styles.btn, mut.isPending && styles.btnDisabled]}
          onPress={() => {
            if (!isValidId(resolvedFarmId)) {
              Alert.alert(
                t("gestationScreen.error"),
                t("gestationScreen.invalidFarmId")
              );
              return;
            }
            if (!isValidId(sowId)) {
              Alert.alert(
                t("gestationScreen.error"),
                t("gestationScreen.pickSow")
              );
              return;
            }
            if (boarId && !isValidId(boarId)) {
              Alert.alert(
                t("gestationScreen.error"),
                t("gestationScreen.invalidBoarId")
              );
              return;
            }
            mut.mutate();
          }}
          disabled={mut.isPending}
        >
          {mut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t("gestationScreen.save")}</Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title={t("modals.sections.animal")}>
        <Text style={styles.label}>{t("gestationScreen.sow")}</Text>
        {lockSow ? (
          <View style={styles.readonlySow}>
            <Text style={styles.readonlySowText}>{sowDisplayLabel}</Text>
          </View>
        ) : (
          <View style={styles.pills}>
            {females.map((a) => {
              const label = a.tagCode?.trim() || a.publicId.slice(0, 8);
              const active = sowId === a.id;
              return (
                <Pressable
                  key={a.id}
                  style={[styles.pill, active && styles.pillOn]}
                  onPress={() => setSowId(a.id)}
                >
                  <Text
                    style={[styles.pillText, active && styles.pillTextOn]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {sow || lockSow ? (
          <Text style={styles.hint}>
            {(sow?.breed?.name ?? "—") +
              (lockSow ? "" : ` · ${t("gestationScreen.matingDate")}`)}
          </Text>
        ) : null}
      </ModalSection>

      <ModalSection title={t("modals.sections.details")}>
        <AppDatePicker
          label={t("gestationScreen.matingDate")}
          isoValue={matingDate}
          onIsoChange={setMatingDate}
          farmId={farmId}
          maxDate={new Date()}
        />

        <Text style={styles.label}>{t("gestationScreen.boar")}</Text>
        <View style={styles.pills}>
          <Pressable
            style={[styles.pill, !boarId && styles.pillOn]}
            onPress={() => setBoarId("")}
          >
            <Text style={styles.pillText}>{t("gestationScreen.noBoar")}</Text>
          </Pressable>
          {males.map((a) => {
            const label = a.tagCode?.trim() || a.publicId.slice(0, 8);
            return (
              <Pressable
                key={a.id}
                style={[styles.pill, boarId === a.id && styles.pillOn]}
                onPress={() => setBoarId(a.id)}
              >
                <Text style={styles.pillText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t("gestationScreen.matingType")}</Text>
        <View style={styles.row}>
          {(["natural", "artificial_insemination"] as const).map((k) => (
            <Pressable
              key={k}
              style={[styles.pill, matingType === k && styles.pillOn]}
              onPress={() => setMatingType(k)}
            >
              <Text style={styles.pillText}>
                {t(`gestationScreen.matingTypes.${k}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("gestationScreen.notes")}</Text>
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "600", color: mobileColors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 10,
    padding: mobileSpacing.sm,
    backgroundColor: "#fff"
  },
  notes: { minHeight: 72, textAlignVertical: "top" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillOn: { backgroundColor: mobileColors.accent },
  pillText: { fontSize: 13, color: mobileColors.textPrimary },
  pillTextOn: { color: "#fff" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontSize: 12, color: mobileColors.textSecondary },
  readonlySow: {
    padding: mobileSpacing.md,
    borderRadius: 10,
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  readonlySowText: {
    fontSize: 16,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  btn: {
    backgroundColor: mobileColors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600" }
});
