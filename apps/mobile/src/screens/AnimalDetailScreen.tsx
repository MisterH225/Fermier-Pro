import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import {
  fetchFarmAnimal,
  postAnimalWeight
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "AnimalDetail">;

function formatKg(v: string | number | undefined): string {
  if (v === undefined || v === null) {
    return "—";
  }
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return String(v);
  }
  return `${n.toFixed(3)} kg`;
}

export function AnimalDetailScreen({ route }: Props) {
  const { farmId, animalId } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();

  const [weightText, setWeightText] = useState("");
  const [noteText, setNoteText] = useState("");

  const animalQuery = useQuery({
    queryKey: ["farmAnimal", farmId, animalId, activeProfileId],
    queryFn: () => fetchFarmAnimal(accessToken, farmId, animalId, activeProfileId)
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const w = Number.parseFloat(weightText.replace(",", "."));
      if (!Number.isFinite(w) || w <= 0) {
        throw new Error("Indique un poids valide (kg).");
      }
      return postAnimalWeight(
        accessToken,
        farmId,
        animalId,
        {
          weightKg: w,
          note: noteText.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      setWeightText("");
      setNoteText("");
      void queryClient.invalidateQueries({
        queryKey: ["farmAnimal", farmId, animalId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["farmAnimals", farmId]
      });
    },
    onError: (e: Error) => {
      Alert.alert("Enregistrement impossible", e.message);
    }
  });

  const animal = animalQuery.data;
  const loading = animalQuery.isPending;
  const err =
    animalQuery.error instanceof Error
      ? animalQuery.error.message
      : animalQuery.error
        ? String(animalQuery.error)
        : null;

  const metaLine = useMemo(() => {
    if (!animal) {
      return "";
    }
    const parts = [
      animal.species.name,
      animal.breed?.name,
      `sexe ${animal.sex}`,
      animal.status !== "active" ? animal.status : null
    ].filter(Boolean);
    return parts.join(" · ");
  }, [animal]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  if (err || !animal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err || "Animal introuvable."}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.meta}>{metaLine}</Text>
      {animal.notes ? (
        <Text style={styles.notes}>{animal.notes}</Text>
      ) : null}

      <Text style={styles.section}>Enregistrer un poids</Text>
      <TextInput
        style={styles.input}
        value={weightText}
        onChangeText={setWeightText}
        placeholder="Poids (kg)"
        placeholderTextColor="#999"
        keyboardType="decimal-pad"
      />
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={noteText}
        onChangeText={setNoteText}
        placeholder="Note (optionnel)"
        placeholderTextColor="#999"
      />
      <TouchableOpacity
        style={[styles.btn, mutation.isPending && styles.btnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        <Text style={styles.btnText}>
          {mutation.isPending ? "Envoi…" : "Ajouter la pesée"}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.section, styles.historyTitle]}>Historique</Text>
      {animal.weights.length === 0 ? (
        <Text style={styles.emptyHist}>Aucune pesée enregistrée.</Text>
      ) : (
        animal.weights.map((row) => (
          <View key={row.id} style={styles.row}>
            <Text style={styles.rowMain}>{formatKg(row.weightKg)}</Text>
            <Text style={styles.rowSub}>
              {new Date(row.measuredAt).toLocaleString()}
            </Text>
            {row.note ? (
              <Text style={styles.rowNote}>{row.note}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f9f8ea"
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: {
    color: "#b00020",
    textAlign: "center"
  },
  meta: {
    fontSize: 15,
    color: "#4b513d",
    marginBottom: 8
  },
  notes: {
    fontSize: 14,
    color: "#6d745b",
    fontStyle: "italic",
    marginBottom: 16
  },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5d7a1f",
    marginBottom: 10,
    marginTop: 8
  },
  historyTitle: {
    marginTop: 24
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e4d4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2910",
    marginBottom: 10
  },
  noteInput: {
    marginBottom: 14
  },
  btn: {
    backgroundColor: "#5d7a1f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  btnDisabled: {
    opacity: 0.7
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  emptyHist: {
    color: "#6d745b",
    fontStyle: "italic"
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  rowMain: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2910"
  },
  rowSub: {
    fontSize: 12,
    color: "#6d745b",
    marginTop: 4
  },
  rowNote: {
    fontSize: 13,
    color: "#4b513d",
    marginTop: 6
  }
});
