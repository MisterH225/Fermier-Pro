import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { HousingModuleGate } from "../components/HousingModuleGate";
import { useSession } from "../context/SessionContext";
import type { PenLogTypeDto } from "../lib/api";
import { createPenLog } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";
import { producerColors } from "../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "CreatePenLog">;

const LOG_TYPES: { key: PenLogTypeDto; label: string }[] = [
  { key: "cleaning", label: "Nettoyage" },
  { key: "disinfection", label: "Désinfection" },
  { key: "mortality", label: "Mortalité" },
  { key: "treatment", label: "Traitement" },
  { key: "other", label: "Autre" }
];

export function CreatePenLogScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { farmId, farmName, penId, penLabel } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [logType, setLogType] = useState<PenLogTypeDto>("cleaning");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createPenLog(
        accessToken,
        farmId,
        penId,
        {
          type: logType,
          title: title.trim(),
          ...(body.trim() ? { body: body.trim() } : {})
        },
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["penDetail", farmId, penId]
      });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert(t("common.errors.saveFailed"), getUserFacingError(e, t));
    }
  });

  const submit = () => {
    if (!title.trim()) {
      Alert.alert("Champ requis", "Indique un titre pour l’entrée de journal.");
      return;
    }
    mutation.mutate();
  };

  if (!clientFeatures.housing) {
    return (
      <HousingModuleGate>
        <View />
      </HousingModuleGate>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.penHint}>{penLabel ?? "Loge"}</Text>

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {LOG_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeChip, logType === t.key && styles.typeChipOn]}
              onPress={() => setLogType(t.key)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  logType === t.key && styles.typeChipTextOn
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Titre</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. Nettoyage complet"
          placeholderTextColor={producerColors.textMuted}
        />

        <Text style={styles.label}>Détail (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={body}
          onChangeText={setBody}
          placeholder="Produit utilisé, observations…"
          placeholderTextColor={producerColors.textMuted}
          multiline
        />

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.ctaText}>Enregistrer dans le journal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary, marginBottom: 4 },
  penHint: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: mobileColors.accent,
    marginBottom: 16
  },
  label: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: producerColors.oliveInk,
    marginBottom: 8
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.xl,
    borderWidth: 1,
    borderColor: producerColors.oliveBorderWarm,
    backgroundColor: mobileColors.background,
    marginRight: 8,
    marginBottom: 8
  },
  typeChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: producerColors.oliveWashSoft
  },
  typeChipText: { fontSize: mobileFontSize.sm, color: producerColors.oliveInk },
  typeChipTextOn: { fontWeight: "700", color: mobileColors.textPrimary },
  input: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: producerColors.oliveBorderWarm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary,
    marginBottom: 16
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  cta: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg }
});
