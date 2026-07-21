import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { VetModuleGate } from "../components/VetModuleGate";
import { useSession } from "../context/SessionContext";
import { addVetConsultationAttachment } from "../lib/api";
import { getUserFacingError } from "../lib/userFacingError";
import type { RootStackParamList } from "../types/navigation";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { producerColors } from "../theme/producerTheme";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "AddVetConsultationAttachment"
>;

export function AddVetConsultationAttachmentScreen({
  route,
  navigation
}: Props) {
  const { t } = useTranslation();
  const { farmId, farmName, consultationId } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [mimeType, setMimeType] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      addVetConsultationAttachment(
        accessToken,
        farmId,
        consultationId,
        {
          url: url.trim(),
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(mimeType.trim() ? { mimeType: mimeType.trim() } : {})
        },
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["vetConsultation", farmId, consultationId]
      });
      void qc.invalidateQueries({ queryKey: ["vetConsultations", farmId] });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert(t("common.errors.saveFailed"), getUserFacingError(e, t));
    }
  });

  const submit = () => {
    const u = url.trim();
    if (!u) {
      Alert.alert("URL requise", "Colle le lien public du fichier (après dépôt sur le stockage).");
      return;
    }
    mutation.mutate();
  };

  if (!clientFeatures.vetConsultations) {
    return (
      <VetModuleGate>
        <View />
      </VetModuleGate>
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
        <Text style={styles.info}>
          Après avoir déposé la photo ou le PDF sur ton espace de stockage
          (ex. bucket Supabase), colle ici l’URL publique ou signée renvoyée par
          le dépôt.
        </Text>

        <Text style={styles.label}>URL du fichier</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={url}
          onChangeText={setUrl}
          placeholder="https://…"
          placeholderTextColor={producerColors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />

        <Text style={styles.label}>Libellé (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Ex. Radiographie jarret"
          placeholderTextColor={producerColors.textMuted}
        />

        <Text style={styles.label}>Type MIME (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={mimeType}
          onChangeText={setMimeType}
          placeholder="application/pdf ou image/jpeg"
          placeholderTextColor={producerColors.textMuted}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.ctaText}>Ajouter la pièce jointe</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: mobileFontSize.sm, color: producerColors.oliveMuted, marginBottom: 8 },
  info: {
    fontSize: mobileFontSize.md,
    color: producerColors.oliveInk,
    lineHeight: 20,
    marginBottom: 16
  },
  label: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: producerColors.oliveInk,
    marginBottom: 8
  },
  input: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: producerColors.oliveBorderWarm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: mobileFontSize.lg,
    color: producerColors.oliveDark,
    marginBottom: 16
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  cta: {
    backgroundColor: producerColors.olive,
    borderRadius: mobileRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg }
});
