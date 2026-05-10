import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { HousingModuleGate } from "../components/HousingModuleGate";
import { useSession } from "../context/SessionContext";
import { fetchFarmBarn } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "BarnDetail">;

export function BarnDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName, barnId, barnName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();

  const q = useQuery({
    queryKey: ["farmBarn", farmId, barnId, activeProfileId],
    queryFn: () => fetchFarmBarn(accessToken, farmId, barnId, activeProfileId),
    enabled: clientFeatures.housing
  });

  const barn = q.data;

  useLayoutEffect(() => {
    const title = barn?.name ?? barnName ?? "Bâtiment";
    navigation.setOptions({
      title,
      headerRight: clientFeatures.housing
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CreatePen", {
                  farmId,
                  farmName,
                  barnId,
                  barnName: title
                })
              }
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Loge</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [
    navigation,
    barn?.name,
    barnName,
    farmId,
    farmName,
    barnId,
    clientFeatures.housing
  ]);

  if (!clientFeatures.housing) {
    return (
      <HousingModuleGate>
        <View />
      </HousingModuleGate>
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

  if (err || !barn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err ?? "Bâtiment introuvable."}</Text>
      </View>
    );
  }

  const pens = barn.pens ?? [];

  return (
    <View style={styles.flex}>
      <Text style={styles.farmHint}>{farmName}</Text>
      {barn.notes ? (
        <Text style={styles.notes}>{barn.notes}</Text>
      ) : null}

      <FlatList
        data={pens}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          pens.length === 0 ? styles.emptyList : styles.list
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
            <Text style={styles.emptyTitle}>Aucune loge</Text>
            <Text style={styles.emptySub}>
              Ajoute des loges à ce bâtiment depuis les outils de gestion ou
              l’API.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("PenDetail", {
                farmId,
                farmName,
                penId: item.id,
                penLabel: item.name
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.zoneLabel ? (
              <Text style={styles.cardMeta}>Zone : {item.zoneLabel}</Text>
            ) : null}
            <Text style={styles.cardMeta}>
              Occupation active : {item._count.placements}
              {item.capacity != null
                ? ` · Capacité ${item.capacity}`
                : ""}
            </Text>
            <Text style={styles.cardStatus}>Statut : {item.status}</Text>
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
    fontSize: 13,
    color: "#6d745b"
  },
  notes: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
    color: "#4a5238",
    lineHeight: 20
  },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: { color: "#a34c24", textAlign: "center" },
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
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#1f2910" },
  cardMeta: { fontSize: 14, color: "#6d745b", marginTop: 6 },
  cardStatus: { fontSize: 13, color: "#5d7a1f", marginTop: 8 },
  headerBtn: { marginRight: 4 },
  headerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 }
});
