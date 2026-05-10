import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { FeedStockModuleGate } from "../components/FeedStockModuleGate";
import { useSession } from "../context/SessionContext";
import type { FeedStockLotDto } from "../lib/api";
import { consumeFeedStockLot, fetchFeedStockLots } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmFeedStock">;

function kgLabel(v: string | number): string {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;
}

export function FarmFeedStockScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [consumeKg, setConsumeKg] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["feedStockLots", farmId, activeProfileId],
    queryFn: () => fetchFeedStockLots(accessToken, farmId, activeProfileId),
    enabled: clientFeatures.feedStock
  });

  const consumeMut = useMutation({
    mutationFn: (p: { lotId: string; kg: number }) =>
      consumeFeedStockLot(
        accessToken,
        farmId,
        p.lotId,
        p.kg,
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feedStockLots", farmId] });
    },
    onError: (e: Error) => Alert.alert("Impossible", e.message)
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.feedStock
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CreateFeedPurchase", { farmId, farmName })
              }
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Achat</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [navigation, farmId, farmName, clientFeatures.feedStock]);

  if (!clientFeatures.feedStock) {
    return (
      <FeedStockModuleGate>
        <View />
      </FeedStockModuleGate>
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
      </View>
    );
  }

  const lots = q.data ?? [];

  return (
    <View style={styles.flex}>
      <Text style={styles.hint}>{farmName}</Text>
      <Text style={styles.subHint}>
        Lots d’aliments achetés et stock restant (hors périmètre paiement).
      </Text>
      <FlatList
        data={lots}
        keyExtractor={(item: FeedStockLotDto) => item.id}
        contentContainerStyle={styles.list}
        refreshing={q.isFetching}
        onRefresh={() => void q.refetch()}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun lot enregistré.</Text>
        }
        renderItem={({ item: lot }: { item: FeedStockLotDto }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{lot.productName}</Text>
            <Text style={styles.line}>
              Restant : {kgLabel(lot.remainingKg)} / acheté{" "}
              {kgLabel(lot.quantityKg)}
            </Text>
            <Text style={styles.meta}>
              Achat le {new Date(lot.purchasedAt).toLocaleDateString("fr-FR")}
              {lot.supplierName ? ` · ${lot.supplierName}` : ""}
            </Text>
            {lot.notes ? (
              <Text style={styles.note}>{lot.notes}</Text>
            ) : null}
            <View style={styles.consumeRow}>
              <TextInput
                style={styles.consumeInput}
                keyboardType="decimal-pad"
                placeholder="kg"
                value={consumeKg[lot.id] ?? ""}
                onChangeText={(t) =>
                  setConsumeKg((prev) => ({ ...prev, [lot.id]: t }))
                }
              />
              <TouchableOpacity
                style={styles.consumeBtn}
                disabled={consumeMut.isPending}
                onPress={() => {
                  const raw = (consumeKg[lot.id] ?? "").trim().replace(",", ".");
                  const n = Number.parseFloat(raw);
                  if (!Number.isFinite(n) || n <= 0) {
                    Alert.alert("Quantité", "Indique un poids en kg valide.");
                    return;
                  }
                  consumeMut.mutate({ lotId: lot.id, kg: n });
                }}
              >
                <Text style={styles.consumeBtnTxt}>Retirer du stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f8ea"
  },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2910"
  },
  subHint: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 13,
    color: "#6d745b"
  },
  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: "center", color: "#6d745b", marginTop: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8e6d8"
  },
  title: { fontSize: 17, fontWeight: "700", color: "#1f2910" },
  line: { fontSize: 14, color: "#4a5238", marginTop: 6 },
  meta: { fontSize: 13, color: "#6d745b", marginTop: 4 },
  note: { fontSize: 13, color: "#6d745b", marginTop: 6, fontStyle: "italic" },
  consumeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12
  },
  consumeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d4d2c4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
    backgroundColor: "#fafaf6"
  },
  consumeBtn: {
    backgroundColor: "#5d7a1f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10
  },
  consumeBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  error: { color: "#b42318", padding: 16 },
  headerBtn: { marginRight: 8 },
  headerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 }
});
