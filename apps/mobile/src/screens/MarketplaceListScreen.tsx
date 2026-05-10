import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { useSession } from "../context/SessionContext";
import type { MarketplaceListingListItem } from "../lib/api";
import { fetchMarketplaceListings } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MarketplaceList">;

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

function listingSearchHaystack(item: MarketplaceListingListItem): string {
  return [
    item.title,
    item.locationLabel,
    item.description,
    item.farm?.name,
    item.seller?.fullName,
    item.animal?.publicId
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(" ")
    .toLowerCase();
}

export function MarketplaceListScreen({ navigation }: Props) {
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const [search, setSearch] = useState("");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.marketplace
        ? () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => navigation.navigate("MarketplaceMyListings")}
                style={{ paddingHorizontal: 6 }}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  Mes annonces
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("MarketplaceMyOffers")}
                style={{ paddingHorizontal: 6 }}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 8 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  Mes offres
                </Text>
              </TouchableOpacity>
            </View>
          )
        : undefined
    });
  }, [navigation, clientFeatures.marketplace]);

  const listingsQuery = useQuery({
    queryKey: ["marketplaceListings", activeProfileId],
    queryFn: () =>
      fetchMarketplaceListings(accessToken, activeProfileId, {
        mine: false
      }),
    enabled: clientFeatures.marketplace
  });

  const err =
    listingsQuery.error instanceof Error
      ? listingsQuery.error.message
      : listingsQuery.error
        ? String(listingsQuery.error)
        : null;

  if (listingsQuery.isPending) {
    return (
      <MarketplaceModuleGate>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5d7a1f" />
        </View>
      </MarketplaceModuleGate>
    );
  }

  if (err) {
    return (
      <MarketplaceModuleGate>
        <View style={styles.centered}>
          <Text style={styles.error}>{err}</Text>
        </View>
      </MarketplaceModuleGate>
    );
  }

  const list = listingsQuery.data ?? [];
  const needle = search.trim().toLowerCase();
  const displayed = useMemo(() => {
    if (!needle) {
      return list;
    }
    return list.filter((item) => listingSearchHaystack(item).includes(needle));
  }, [list, needle]);

  const emptyMessage =
    list.length === 0
      ? "Aucune annonce publiée pour le moment."
      : needle
        ? "Aucun résultat pour cette recherche."
        : "Aucune annonce publiée pour le moment.";

  return (
    <MarketplaceModuleGate>
      <FlatList
      data={displayed}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={listingsQuery.isFetching}
          onRefresh={() => void listingsQuery.refetch()}
        />
      }
      ListHeaderComponent={
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher (titre, lieu, ferme, vendeur…)"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <TouchableOpacity
              style={styles.searchClearBtn}
              onPress={() => setSearch("")}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.searchClearTxt}>Effacer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
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
          <Text style={styles.price}>
            {formatPrice(item.unitPrice, item.currency)}
            {item.quantity != null ? ` · ${item.quantity} unité(s)` : ""}
          </Text>
          {item.locationLabel ? (
            <Text style={styles.meta}>{item.locationLabel}</Text>
          ) : null}
          {item.farm ? (
            <Text style={styles.meta}>Ferme : {item.farm.name}</Text>
          ) : null}
          {item.seller?.fullName ? (
            <Text style={styles.seller}>Vendeur : {item.seller.fullName}</Text>
          ) : null}
        </TouchableOpacity>
      )}
    />
    </MarketplaceModuleGate>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e4d4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: "#1f2910"
  },
  searchClearBtn: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  searchClearTxt: {
    color: "#5d7a1f",
    fontWeight: "600",
    fontSize: 15
  },
  list: {
    padding: 16,
    paddingBottom: 32
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
  price: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#5d7a1f"
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: "#6d745b"
  },
  seller: {
    marginTop: 8,
    fontSize: 13,
    color: "#4b513d"
  }
});
