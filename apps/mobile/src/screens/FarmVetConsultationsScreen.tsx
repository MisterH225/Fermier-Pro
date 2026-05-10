import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { VetModuleGate } from "../components/VetModuleGate";
import { useSession } from "../context/SessionContext";
import type { VetConsultationStatusDto } from "../lib/api";
import { fetchVetConsultations } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmVetConsultations">;

const STATUS_FR: Record<string, string> = {
  open: "Ouverte",
  in_progress: "En cours",
  resolved: "Résolue",
  cancelled: "Annulée"
};

type VetFilterKey = "all" | VetConsultationStatusDto;

const FILTERS: { key: VetFilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "open", label: "Ouvertes" },
  { key: "in_progress", label: "En cours" },
  { key: "resolved", label: "Résolues" },
  { key: "cancelled", label: "Annulées" }
];

export function FarmVetConsultationsScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const [filter, setFilter] = useState<VetFilterKey>("all");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.vetConsultations
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CreateVetConsultation", { farmId, farmName })
              }
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Dossier</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [navigation, farmId, farmName, clientFeatures.vetConsultations]);

  const q = useQuery({
    queryKey: ["vetConsultations", farmId, activeProfileId, filter],
    queryFn: () =>
      fetchVetConsultations(
        accessToken,
        farmId,
        activeProfileId,
        filter === "all" ? undefined : filter
      ),
    enabled: clientFeatures.vetConsultations
  });

  useFocusEffect(
    useCallback(() => {
      void q.refetch();
    }, [q.refetch])
  );

  if (!clientFeatures.vetConsultations) {
    return (
      <VetModuleGate>
        <View />
      </VetModuleGate>
    );
  }

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  const err =
    q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null;

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
        <Text style={styles.hint}>
          Scopes requis : vet.read sur cette ferme.
        </Text>
      </View>
    );
  }

  const rows = q.data ?? [];

  return (
    <View style={styles.flex}>
      <Text style={styles.farmHint}>{farmName}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              filter === f.key && styles.filterChipOn
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.key && styles.filterChipTextOn
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          rows.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor="#5d7a1f"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aucune consultation</Text>
            <Text style={styles.emptySub}>
              {filter === "all"
                ? "Crée un dossier pour suivre un cas avec ton vétérinaire (pièces jointes via lien après dépôt sur le stockage)."
                : "Aucun dossier pour ce filtre — essaie « Toutes » ou un autre statut."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("VetConsultationDetail", {
                farmId,
                farmName,
                consultationId: item.id
              })
            }
          >
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.subject}
            </Text>
            <Text style={styles.cardMeta}>
              {STATUS_FR[item.status] ?? item.status} ·{" "}
              {new Date(item.openedAt).toLocaleDateString("fr-FR")}
            </Text>
            {item.animal ? (
              <Text style={styles.cardAnimal}>
                Animal : {item.animal.tagCode ?? item.animal.publicId}
              </Text>
            ) : null}
            {item.summary ? (
              <Text style={styles.cardPreview} numberOfLines={2}>
                {item.summary}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  farmHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 13,
    color: "#6d745b"
  },
  filterScroll: { maxHeight: 48, marginBottom: 4 },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e4d4",
    backgroundColor: "#fff",
    marginRight: 8
  },
  filterChipOn: {
    borderColor: "#5d7a1f",
    backgroundColor: "#e8efd9"
  },
  filterChipText: {
    fontSize: 13,
    color: "#4b513d"
  },
  filterChipTextOn: {
    color: "#1f2910",
    fontWeight: "600"
  },
  list: { padding: 16, paddingTop: 4, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: { color: "#a34c24", textAlign: "center", marginBottom: 8 },
  hint: { fontSize: 13, color: "#6d745b", textAlign: "center" },
  emptyBox: { padding: 32 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2910",
    marginBottom: 8
  },
  emptySub: { fontSize: 14, color: "#6d745b", lineHeight: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8e4d4"
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1f2910" },
  cardMeta: { fontSize: 13, color: "#6d745b", marginTop: 6 },
  cardAnimal: { fontSize: 13, color: "#5d7a1f", marginTop: 4 },
  cardPreview: { fontSize: 14, color: "#4a5238", marginTop: 8 },
  headerBtn: { marginRight: 4 },
  headerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 }
});
