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
import { HousingModuleGate } from "../components/HousingModuleGate";
import { useSession } from "../context/SessionContext";
import { createFarmBarn } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateBarn">;

export function CreateBarnScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [sortOrderText, setSortOrderText] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      let sortOrder: number | undefined;
      if (sortOrderText.trim()) {
        const n = Number.parseInt(sortOrderText.trim(), 10);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Ordre d’affichage invalide.");
        }
        sortOrder = n;
      }
      return createFarmBarn(
        accessToken,
        farmId,
        {
          name: name.trim(),
          ...(code.trim() ? { code: code.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {})
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmBarns", farmId] });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert("Création impossible", e.message);
    }
  });

  const submit = () => {
    if (!name.trim()) {
      Alert.alert("Champ requis", "Indique un nom pour le bâtiment.");
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
        <Text style={styles.hint}>{farmName}</Text>

        <Text style={styles.label}>Nom du bâtiment</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex. Nurserie nord"
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Code (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Ex. N1"
          placeholderTextColor="#a8a99a"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Notes (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Accès, équipements…"
          placeholderTextColor="#a8a99a"
          multiline
        />

        <Text style={styles.label}>Ordre d’affichage (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={sortOrderText}
          onChangeText={setSortOrderText}
          placeholder="0 par défaut si vide"
          placeholderTextColor="#a8a99a"
          keyboardType="number-pad"
        />

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Créer le bâtiment</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: "#6d745b", marginBottom: 16 },
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
  multiline: { minHeight: 88, textAlignVertical: "top" },
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
