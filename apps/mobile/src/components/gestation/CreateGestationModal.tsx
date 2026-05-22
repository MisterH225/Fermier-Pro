import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import type { AnimalListItem } from "../../lib/api";
import { createGestation } from "../../lib/api";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  females: AnimalListItem[];
  males: AnimalListItem[];
  onClose: () => void;
  onCreated: () => void;
};

export function CreateGestationModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  females,
  males,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const [sowId, setSowId] = useState("");
  const [boarId, setBoarId] = useState("");
  const [matingDate, setMatingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [matingType, setMatingType] = useState<
    "natural" | "artificial_insemination"
  >("natural");
  const [notes, setNotes] = useState("");

  const sow = useMemo(
    () => females.find((a) => a.id === sowId),
    [females, sowId]
  );

  const mut = useMutation({
    mutationFn: () =>
      createGestation(
        accessToken,
        farmId,
        {
          sowId,
          boarId: boarId || undefined,
          matingType,
          matingDate,
          notes: notes.trim() || undefined
        },
        activeProfileId
      ),
    onSuccess: () => {
      onCreated();
      onClose();
      Alert.alert(t("gestationScreen.createSuccessTitle"));
    },
    onError: (e: Error) => Alert.alert(t("gestationScreen.error"), e.message)
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
            if (!sowId) {
              Alert.alert(t("gestationScreen.pickSow"));
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
      <View style={styles.body}>
        <Text style={styles.label}>{t("gestationScreen.sow")}</Text>
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
                <Text style={[styles.pillText, active && styles.pillTextOn]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {sow ? (
          <Text style={styles.hint}>
            {sow.breed?.name ?? "—"} · {t("gestationScreen.matingDate")}
          </Text>
        ) : null}

        <Text style={styles.label}>{t("gestationScreen.matingDate")}</Text>
        <TextInput
          style={styles.input}
          value={matingDate}
          onChangeText={setMatingDate}
          placeholder="YYYY-MM-DD"
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
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: mobileSpacing.md, paddingBottom: mobileSpacing.lg },
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
  btn: {
    backgroundColor: mobileColors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600" }
});
