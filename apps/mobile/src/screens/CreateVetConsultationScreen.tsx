import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import type { AnimalListItem } from "../lib/api";
import { createVetConsultation, fetchFarmAnimals } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateVetConsultation">;

function animalTitle(a: AnimalListItem): string {
  const tag = a.tagCode?.trim() || a.publicId;
  return `${a.species.name} · ${tag}`;
}

export function CreateVetConsultationScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: clientFeatures.vetConsultations
  });

  const mutation = useMutation({
    mutationFn: () =>
      createVetConsultation(
        accessToken,
        farmId,
        {
          subject: subject.trim(),
          ...(summary.trim() ? { summary: summary.trim() } : {}),
          ...(selectedAnimalId ? { animalId: selectedAnimalId } : {})
        },
        activeProfileId
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["vetConsultations", farmId] });
      navigation.replace("VetConsultationDetail", {
        farmId,
        farmName,
        consultationId: data.id
      });
    },
    onError: (e: Error) => {
      Alert.alert("Création impossible", e.message);
    }
  });

  const submit = () => {
    if (!subject.trim()) {
      Alert.alert("Champ requis", "Indique un objet pour le dossier.");
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

  const animals = animalsQuery.data ?? [];

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

        <Text style={styles.label}>Objet</Text>
        <TextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="Ex. Boiterie truie 12"
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Résumé (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={summary}
          onChangeText={setSummary}
          placeholder="Symptômes, contexte…"
          placeholderTextColor="#a8a99a"
          multiline
        />

        <Text style={styles.label}>Animal lié (optionnel)</Text>
        <TouchableOpacity
          style={[styles.chip, selectedAnimalId === null && styles.chipOn]}
          onPress={() => setSelectedAnimalId(null)}
        >
          <Text
            style={[
              styles.chipText,
              selectedAnimalId === null && styles.chipTextOn
            ]}
          >
            Aucun animal
          </Text>
        </TouchableOpacity>

        {animalsQuery.isPending ? (
          <View style={styles.animalsLoading}>
            <ActivityIndicator color="#5d7a1f" />
          </View>
        ) : animals.length === 0 ? (
          <Text style={styles.muted}>
            Aucun animal sur cette ferme pour l’instant — tu peux quand même
            créer le dossier.
          </Text>
        ) : (
          <View style={styles.chipWrap}>
            {animals.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.chip,
                  selectedAnimalId === a.id && styles.chipOn
                ]}
                onPress={() => setSelectedAnimalId(a.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedAnimalId === a.id && styles.chipTextOn
                  ]}
                  numberOfLines={2}
                >
                  {animalTitle(a)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Créer le dossier</Text>
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
  multiline: { minHeight: 120, textAlignVertical: "top" },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    marginTop: 4
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e8e4d4",
    backgroundColor: "#fff",
    marginRight: 8,
    marginBottom: 8,
    maxWidth: "100%"
  },
  chipOn: {
    borderColor: "#5d7a1f",
    backgroundColor: "#eef4dc"
  },
  chipText: { fontSize: 13, color: "#4a5238" },
  chipTextOn: { fontWeight: "700", color: "#1f2910" },
  muted: {
    fontSize: 14,
    color: "#6d745b",
    marginBottom: 16,
    lineHeight: 20
  },
  animalsLoading: { paddingVertical: 12, marginBottom: 8 },
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
