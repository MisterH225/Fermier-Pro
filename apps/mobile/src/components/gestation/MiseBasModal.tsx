import { useMutation } from "@tanstack/react-query";
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
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { recordGestationLitter } from "../../lib/api";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmId: string;
  gestationId: string;
  sowLabel: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function MiseBasModal({
  visible,
  farmId,
  gestationId,
  sowLabel,
  accessToken,
  activeProfileId,
  onClose,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const now = new Date().toISOString();
  const [actualBirthDate, setActualBirthDate] = useState(now);
  const [bornAlive, setBornAlive] = useState("");
  const [stillborn, setStillborn] = useState("0");
  const [mummified, setMummified] = useState("0");
  const [avgWeight, setAvgWeight] = useState("");
  const [deliveryType, setDeliveryType] = useState<
    "normal" | "difficult" | "cesarean"
  >("normal");
  const [vetAssistance, setVetAssistance] = useState(false);
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      const alive = Number.parseInt(bornAlive, 10);
      const dead = Number.parseInt(stillborn, 10) || 0;
      if (!Number.isFinite(alive) || alive < 0) {
        throw new Error(t("gestationScreen.invalidBornAlive"));
      }
      return recordGestationLitter(
        accessToken,
        farmId,
        gestationId,
        {
          actualBirthDate,
          bornAlive: alive,
          stillborn: dead,
          mummified: Number.parseInt(mummified, 10) || 0,
          averageBirthWeightKg: avgWeight
            ? Number.parseFloat(avgWeight)
            : undefined,
          deliveryType,
          vetAssistance,
          notes: notes.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: (data) => {
      onSaved();
      onClose();
      const n = data.litter
        ? (data as { litter?: { bornAlive?: number } }).litter?.bornAlive
        : bornAlive;
      Alert.alert(
        t("gestationScreen.litterSuccessTitle"),
        t("gestationScreen.litterSuccessBody", { count: n ?? bornAlive })
      );
    },
    onError: (e: Error) => Alert.alert(t("gestationScreen.error"), e.message)
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("gestationScreen.litterTitle")}
      statusBadge={{ label: sowLabel, tone: "neutral" }}
      footerPrimary={
        <Pressable
          style={[styles.btn, mut.isPending && styles.btnDisabled]}
          onPress={() => mut.mutate()}
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
      <ModalSection title={t("modals.sections.details")}>
        <Text style={styles.label}>{t("gestationScreen.birthDateTime")}</Text>
        <TextInput
          style={styles.input}
          value={actualBirthDate}
          onChangeText={setActualBirthDate}
        />
        <Text style={styles.label}>{t("gestationScreen.bornAlive")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={bornAlive}
          onChangeText={setBornAlive}
        />
        <Text style={styles.label}>{t("gestationScreen.stillborn")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={stillborn}
          onChangeText={setStillborn}
        />
        <Text style={styles.label}>{t("gestationScreen.mummified")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={mummified}
          onChangeText={setMummified}
        />
        <Text style={styles.label}>{t("gestationScreen.avgWeight")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={avgWeight}
          onChangeText={setAvgWeight}
        />
        <Text style={styles.label}>{t("gestationScreen.deliveryType")}</Text>
        <View style={styles.row}>
          {(["normal", "difficult", "cesarean"] as const).map((k) => (
            <Pressable
              key={k}
              style={[styles.pill, deliveryType === k && styles.pillOn]}
              onPress={() => setDeliveryType(k)}
            >
              <Text style={styles.pillText}>
                {t(`gestationScreen.deliveryTypes.${k}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={styles.toggle}
          onPress={() => setVetAssistance((v) => !v)}
        >
          <Text>
            {t("gestationScreen.vetAssistance")}: {vetAssistance ? "✓" : "—"}
          </Text>
        </Pressable>
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
  body: { gap: mobileSpacing.md },
  label: { fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 10,
    padding: mobileSpacing.sm,
    backgroundColor: "#fff"
  },
  notes: { minHeight: 64 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillOn: { backgroundColor: mobileColors.accent },
  pillText: { fontSize: 12 },
  toggle: { paddingVertical: 8 },
  btn: {
    backgroundColor: mobileColors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600" }
});
