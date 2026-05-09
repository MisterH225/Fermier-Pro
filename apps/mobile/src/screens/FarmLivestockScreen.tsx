import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import {
  fetchFarmAnimals,
  fetchFarmBatches
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmLivestock">;

function formatKg(v: string | number | undefined): string {
  if (v === undefined || v === null) {
    return "—";
  }
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return String(v);
  }
  return `${n.toFixed(1)} kg`;
}

export function FarmLivestockScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId } = useSession();

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId)
  });

  const batchesQuery = useQuery({
    queryKey: ["farmBatches", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken, farmId, activeProfileId)
  });

  const refreshing = animalsQuery.isFetching || batchesQuery.isFetching;
  const onRefresh = useCallback(() => {
    void animalsQuery.refetch();
    void batchesQuery.refetch();
  }, [animalsQuery, batchesQuery]);

  const loading =
    animalsQuery.isPending || batchesQuery.isPending;
  const errMsg =
    (animalsQuery.error as Error | undefined)?.message ||
    (batchesQuery.error as Error | undefined)?.message;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
        <Text style={styles.sub}>{farmName}</Text>
      </View>
    );
  }

  if (errMsg) {
    return (
      <ScrollView
        contentContainerStyle={styles.centered}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.error}>{errMsg}</Text>
        <Text style={styles.hint}>
          Accès refusé ? Vérifie ton rôle sur la ferme (scopes livestock) ou
          change de profil actif.
        </Text>
      </ScrollView>
    );
  }

  const animals = animalsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.farmTitle}>{farmName}</Text>

      <Text style={styles.sectionTitle}>Animaux (suivi individuel)</Text>
      {animals.length === 0 ? (
        <Text style={styles.empty}>Aucun animal enregistré.</Text>
      ) : (
        animals.map((a) => {
          const tag = a.tagCode || a.publicId.slice(0, 8);
          const w = a.weights[0];
          return (
            <TouchableOpacity
              key={a.id}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() =>
                navigation.navigate("AnimalDetail", {
                  farmId,
                  farmName,
                  animalId: a.id,
                  headline: tag
                })
              }
            >
              <Text style={styles.cardTitle}>
                {tag} · {a.species.name}
              </Text>
              <Text style={styles.cardSub}>
                Sexe {a.sex}
                {a.breed ? ` · ${a.breed.name}` : ""}
              </Text>
              <Text style={styles.cardMeta}>
                Dernier poids : {formatKg(w?.weightKg)}
                {w?.measuredAt
                  ? ` (${new Date(w.measuredAt).toLocaleDateString()})`
                  : ""}
              </Text>
              <Text style={styles.cardHint}>Détail & pesées →</Text>
            </TouchableOpacity>
          );
        })
      )}

      <Text style={[styles.sectionTitle, styles.sectionSecond]}>
        Lots (bandes)
      </Text>
      {batches.length === 0 ? (
        <Text style={styles.empty}>Aucun lot enregistré.</Text>
      ) : (
        batches.map((b) => {
          const w = b.weights?.[0];
          return (
            <TouchableOpacity
              key={b.id}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() =>
                navigation.navigate("BatchDetail", {
                  farmId,
                  farmName,
                  batchId: b.id,
                  batchName: b.name
                })
              }
            >
              <Text style={styles.cardTitle}>
                {b.name} · {b.headcount} tête{b.headcount > 1 ? "s" : ""}
              </Text>
              <Text style={styles.cardSub}>
                {b.species.name}
                {b.breed ? ` · ${b.breed.name}` : ""} · {b.status}
              </Text>
              <Text style={styles.cardMeta}>
                Poids moyen récent : {formatKg(w?.avgWeightKg)}
                {w?.measuredAt
                  ? ` (${new Date(w.measuredAt).toLocaleDateString()})`
                  : ""}
              </Text>
              <Text style={styles.cardHint}>Détail & pesées →</Text>
            </TouchableOpacity>
          );
        })
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
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea",
    minHeight: 400
  },
  sub: {
    marginTop: 12,
    color: "#6d745b"
  },
  farmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2910",
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5d7a1f",
    marginBottom: 10
  },
  sectionSecond: {
    marginTop: 22
  },
  empty: {
    color: "#6d745b",
    fontSize: 14,
    marginBottom: 8,
    fontStyle: "italic"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2910"
  },
  cardSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#6d745b"
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#4b513d"
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#5d7a1f",
    fontWeight: "600"
  },
  error: {
    color: "#b00020",
    textAlign: "center",
    marginBottom: 12
  },
  hint: {
    fontSize: 13,
    color: "#6d745b",
    textAlign: "center",
    lineHeight: 18
  }
});
