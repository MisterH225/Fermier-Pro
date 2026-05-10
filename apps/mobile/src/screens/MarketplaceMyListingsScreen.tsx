import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
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
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { useSession } from "../context/SessionContext";
import type { MarketplaceListingListItem } from "../lib/api";
import { fetchMarketplaceListings } from "../lib/api";
import { listingStatusLabel } from "../lib/marketplaceLabels";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MarketplaceMyListings">;

type ListingFilter = "all" | "draft" | "published" | "sold" | "cancelled";

const FILTERS: { key: ListingFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "draft", label: "Brouillons" },
  { key: "published", label: "Publiées" },
  { key: "sold", label: "Vendues" },
  { key: "cancelled", label: "Annulées" }
];

function formatPrice(
  unitPrice: string | number | null | undefined,
  currency: string
): string {
  if (unitPrice === undefined || unitPrice === null) {
    return "Prix sur demande";
  }
  const n =
    typeof unitPrice === "string" ? Number.parseFloat(unitPrice) : Number(unitPrice);
  if (!Number.isFinite(n)) {
    return String(unitPrice);
  }
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

export function MarketplaceMyListingsScreen({ navigation }: Props) {
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const [filter, setFilter] = useState<ListingFilter>("all");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.marketplace
        ? () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("CreateMarketplaceListing", {})}
              style={{ paddingHorizontal: 8 }}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                Créer
              </Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [navigation, clientFeatures.marketplace]);

  const q = useQuery({
    queryKey: ["marketplaceMyListings", activeProfileId, filter],
    queryFn: () =>
      fetchMarketplaceListings(accessToken, activeProfileId, {
        mine: true,
        ...(filter !== "all" ? { status: filter } : {})
      }),
    enabled: clientFeatures.marketplace
  });

  const err =
    q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null;

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
      </View>
    );
  }

  const rows = q.data ?? [];

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />
      }
      ListHeaderComponent={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, filter === key && styles.filterChipOn]}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[styles.filterChipTxt, filter === key && styles.filterChipTxtOn]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {filter === "all"
            ? "Tu n&apos;as pas encore d&apos;annonce. Utilise « Créer » pour en ajouter une."
            : "Aucune annonce dans ce filtre."}
        </Text>
      }
      renderItem={({ item }: { item: MarketplaceListingListItem }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            navigation.navigate("MarketplaceListingDetail", {
              listingId: item.id,
              headline: item.title
            })
          }
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.badge}>{listingStatusLabel(item.status)}</Text>
          <Text style={styles.price}>
            {formatPrice(item.unitPrice, item.currency)}
            {item.quantity != null ? ` · ${item.quantity} unité(s)` : ""}
          </Text>
          {item.farm ? (
            <Text style={styles.meta}>Ferme : {item.farm.name}</Text>
          ) : null}
          {item.animal ? (
            <Text style={styles.meta}>Animal : {item.animal.publicId}</Text>
          ) : null}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32
  },
  filterRow: {
    paddingBottom: 12
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#c8d4b0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    backgroundColor: "#fff"
  },
  filterChipOn: {
    backgroundColor: "#5d7a1f",
    borderColor: "#5d7a1f"
  },
  filterChipTxt: {
    fontSize: 14,
    color: "#1f2910"
  },
  filterChipTxtOn: {
    color: "#fff",
    fontWeight: "600"
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
  empty: {
    textAlign: "center",
    color: "#6d745b",
    marginTop: 24,
    fontStyle: "italic"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2910"
  },
  badge: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: "#5d7a1f",
    backgroundColor: "#e8efd8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden"
  },
  price: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "600",
    color: "#4b513d"
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: "#6d745b"
  }
});
