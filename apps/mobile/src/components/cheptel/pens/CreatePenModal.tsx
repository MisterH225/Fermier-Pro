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
import { useModal } from "../../modals/useModal";
import { createPen } from "../../../lib/api";
import {
  offlineAwareMessage,
  offlineQueuedMessage,
  useOfflineMutation
} from "../../../hooks/useOfflineMutation";
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
  barns: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated: () => void;
};

export function CreatePenModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  barns,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const [barnId, setBarnId] = useState(barns[0]?.id ?? "");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("12");

  const buildPenPayload = () => {
    const cap = Number.parseInt(capacity, 10);
    if (!barnId || !name.trim()) {
      throw new Error(t("cheptel.pens.createMissing"));
    }
    return {
      name: name.trim(),
      capacity: Number.isFinite(cap) ? cap : undefined
    };
  };

  const saveMut = useOfflineMutation({
    farmId,
    type: "cheptel.createPen",
    label: name.trim() || t("cheptel.pens.createTitle"),
    mutationFn: async () => {
      const payload = buildPenPayload();
      return createPen(accessToken, farmId, barnId, payload, activeProfileId);
    },
    buildOfflineItem: () => {
      const payload = buildPenPayload();
      return {
        calls: [
          {
            method: "POST",
            path: `/farms/${farmId}/barns/${barnId}/pens`,
            body: payload
          }
        ],
        invalidateRoots: [
          "cheptelPens",
          "farmBarns",
          "farmBarnDetails",
          "farmBarn"
        ]
      };
    },
    onSuccess: (data) => {
      onCreated();
      onClose();
      open("success", {
        message: offlineAwareMessage(t, data, "cheptel.pens.createSuccess"),
        autoDismissMs: 2000
      });
    },
    onQueued: () => {
      onCreated();
      onClose();
      open("success", {
        message: offlineQueuedMessage(t),
        autoDismissMs: 2600
      });
    },
    onError: (e: Error) => Alert.alert("", e.message)
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.pens.createTitle")}
      footerPrimary={
        <Pressable
          style={styles.primary}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryTx}>{t("cheptel.pens.createSubmit")}</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.label}>{t("cheptel.pens.barn")}</Text>
      <View style={styles.pillRow}>
        {barns.map((b) => (
          <Pressable
            key={b.id}
            style={[styles.pill, barnId === b.id && styles.pillOn]}
            onPress={() => setBarnId(b.id)}
          >
            <Text style={[styles.pillTx, barnId === b.id && styles.pillTxOn]}>
              {b.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("cheptel.pens.penName")}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.label}>{t("cheptel.pens.capacity")}</Text>
      <TextInput
        style={styles.input}
        value={capacity}
        onChangeText={setCapacity}
        keyboardType="number-pad"
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    marginTop: mobileSpacing.sm,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    backgroundColor: mobileColors.background
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 12,
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
