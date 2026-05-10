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
import { HousingModuleGate } from "../components/HousingModuleGate";
import { useSession } from "../context/SessionContext";
import { fetchFarmBarn, fetchFarmBarns, postPenMove } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "PenMove">;

export function PenMoveScreen({ route, navigation }: Props) {
  const {
    farmId,
    farmName,
    fromPenId,
    fromPenLabel,
    animalId,
    batchId,
    occupantSummary
  } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [selectedBarnId, setSelectedBarnId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const hasAnimal = Boolean(animalId);
  const hasBatch = Boolean(batchId);
  const occupantOk =
    (hasAnimal && !hasBatch) || (!hasAnimal && hasBatch);

  const barnsQuery = useQuery({
    queryKey: ["farmBarns", farmId, activeProfileId],
    queryFn: () => fetchFarmBarns(accessToken, farmId, activeProfileId),
    enabled: clientFeatures.housing && occupantOk
  });

  const barnDetailQuery = useQuery({
    queryKey: ["farmBarn", farmId, selectedBarnId, activeProfileId],
    queryFn: () =>
      fetchFarmBarn(accessToken, farmId, selectedBarnId!, activeProfileId),
    enabled:
      clientFeatures.housing && !!selectedBarnId && occupantOk
  });

  const mutation = useMutation({
    mutationFn: (toPenId: string) =>
      postPenMove(
        accessToken,
        farmId,
        {
          toPenId,
          fromPenId,
          ...(animalId ? { animalId } : {}),
          ...(batchId ? { batchId } : {}),
          ...(note.trim() ? { note: note.trim() } : {})
        },
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["penDetail", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmBarns", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmBarn", farmId] });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert("Déplacement impossible", e.message);
    }
  });

  const confirmMove = (toPenId: string, toPenName: string) => {
    if (toPenId === fromPenId) {
      Alert.alert(
        "Même loge",
        "Choisis une autre loge que celle d’origine."
      );
      return;
    }
    Alert.alert(
      "Confirmer le déplacement",
      `Vers la loge « ${toPenName} » ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déplacer",
          onPress: () => mutation.mutate(toPenId)
        }
      ]
    );
  };

  if (!clientFeatures.housing) {
    return (
      <HousingModuleGate>
        <View />
      </HousingModuleGate>
    );
  }

  if (!occupantOk) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          Mouvement invalide : indique un animal ou une bande (pas les deux).
        </Text>
      </View>
    );
  }

  const barns = barnsQuery.data ?? [];
  const pens =
    barnDetailQuery.data?.pens?.filter((p) => p.id !== fromPenId) ?? [];

  const occupantFallback = hasAnimal
    ? `Animal ${animalId!.slice(0, 8)}…`
    : `Bande ${batchId!.slice(0, 8)}…`;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>{farmName}</Text>
        <Text style={styles.fromLine}>
          Depuis : {fromPenLabel ?? "Loge"} —{" "}
          {occupantSummary ?? occupantFallback}
        </Text>

        <Text style={styles.label}>Note (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="Motif, observations…"
          placeholderTextColor="#a8a99a"
          multiline
        />

        {!selectedBarnId ? (
          <>
            <Text style={styles.sectionTitle}>Choisir un bâtiment</Text>
            {barnsQuery.isPending ? (
              <ActivityIndicator color="#5d7a1f" />
            ) : (
              barns.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.card}
                  onPress={() => setSelectedBarnId(b.id)}
                >
                  <Text style={styles.cardTitle}>{b.name}</Text>
                  <Text style={styles.cardMeta}>
                    {b._count.pens} loge{b._count.pens === 1 ? "" : "s"}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backBarn}
              onPress={() => setSelectedBarnId(null)}
            >
              <Text style={styles.backBarnText}>← Autre bâtiment</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>Choisir une loge d’arrivée</Text>
            {barnDetailQuery.isPending ? (
              <ActivityIndicator color="#5d7a1f" />
            ) : pens.length === 0 ? (
              <Text style={styles.muted}>
                Aucune autre loge dans ce bâtiment. Choisis un autre bâtiment.
              </Text>
            ) : (
              pens.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.card}
                  disabled={mutation.isPending}
                  onPress={() => confirmMove(p.id, p.name)}
                >
                  <Text style={styles.cardTitle}>{p.name}</Text>
                  <Text style={styles.cardMeta}>
                    Occupation : {p._count.placements}
                    {p.capacity != null ? ` · Cap. ${p.capacity}` : ""}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: { color: "#a34c24", textAlign: "center" },
  hint: { fontSize: 13, color: "#6d745b", marginBottom: 6 },
  fromLine: {
    fontSize: 14,
    color: "#5d7a1f",
    marginBottom: 16,
    fontWeight: "600"
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
  noteInput: { minHeight: 72, textAlignVertical: "top" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2910",
    marginBottom: 10
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8e4d4"
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1f2910" },
  cardMeta: { fontSize: 13, color: "#6d745b", marginTop: 6 },
  backBarn: { marginBottom: 12 },
  backBarnText: { fontSize: 15, fontWeight: "700", color: "#5d7a1f" },
  muted: { fontSize: 14, color: "#6d745b" }
});
