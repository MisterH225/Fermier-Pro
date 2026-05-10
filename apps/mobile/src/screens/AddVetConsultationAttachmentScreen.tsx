import type { NativeStackScreenProps } from "@react-navigation/native-stack";
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
import { VetModuleGate } from "../components/VetModuleGate";
import { useSession } from "../context/SessionContext";
import { addVetConsultationAttachment } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "AddVetConsultationAttachment"
>;

export function AddVetConsultationAttachmentScreen({
  route,
  navigation
}: Props) {
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
      Alert.alert("Ajout impossible", e.message);
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
        <Text style={styles.hint}>{farmName}</Text>
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
          placeholderTextColor="#a8a99a"
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
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Type MIME (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={mimeType}
          onChangeText={setMimeType}
          placeholder="application/pdf ou image/jpeg"
          placeholderTextColor="#a8a99a"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Ajouter la pièce jointe</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: "#6d745b", marginBottom: 8 },
  info: {
    fontSize: 14,
    color: "#4a5238",
    lineHeight: 20,
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4a5238",
    marginBottom: 8
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8e4d4",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2910",
    marginBottom: 16
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  cta: {
    backgroundColor: "#5d7a1f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
