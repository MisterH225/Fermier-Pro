import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useLayoutEffect } from "react";
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
import { fetchFarmBarns } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmBarns">;

export function FarmBarnsScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.housing
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CreateBarn", { farmId, farmName })
              }
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Bâtiment</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [navigation, farmId, farmName, clientFeatures.housing]);

  const q = useQuery({
    queryKey: ["farmBarns", farmId, activeProfileId],
    queryFn: () => fetchFarmBarns(accessToken, farmId, activeProfileId),
    enabled: clientFeatures.housing
  });

  useFocusEffect(
    useCallback(() => {
      void q.refetch();
    }, [q.refetch])
  );

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

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
        <Text style={styles.hint}>
          Scopes requis : housing.read sur cette ferme.
        </Text>
      </View>
    );
  }

  const barns = q.data ?? [];

  return (
    <View style={styles.flex}>
      <Text style={styles.farmHint}>{farmName}</Text>
      <FlatList
        data={barns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          barns.length === 0 ? styles.emptyList : styles.list
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
            <Text style={styles.emptyTitle}>Aucun bâtiment</Text>
            <Text style={styles.emptySub}>
              Les bâtiments et loges sont créés depuis l’interface complète ou
              l’API ; ils apparaîtront ici une fois configurés.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("BarnDetail", {
                farmId,
                farmName,
                barnId: item.id,
                barnName: item.name
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.code ? (
              <Text style={styles.cardMeta}>Code : {item.code}</Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {item._count.pens} loge{item._count.pens === 1 ? "" : "s"}
            </Text>
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
  list: { padding: 16, paddingBottom: 32 },
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
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#1f2910" },
  cardMeta: { fontSize: 14, color: "#6d745b", marginTop: 6 },
  headerBtn: { marginRight: 4 },
  headerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 }
});
