import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { useSession } from "../context/SessionContext";
import type { MarketplaceOfferMineRow } from "../lib/api";
import {
  fetchMyMarketplaceOffers,
  withdrawMarketplaceOffer
} from "../lib/api";
import {
  listingStatusLabel,
  marketplaceActionErrorMessage,
  offerStatusLabel
} from "../lib/marketplaceLabels";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MarketplaceMyOffers">;

function formatMoney(v: string | number, currency: string): string {
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return String(v);
  }
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

export function MarketplaceMyOffersScreen({ navigation }: Props) {
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["marketplaceMyOffers", activeProfileId],
    queryFn: () => fetchMyMarketplaceOffers(accessToken, activeProfileId),
    enabled: clientFeatures.marketplace
  });

  const withdrawMut = useMutation({
    mutationFn: (offerId: string) =>
      withdrawMarketplaceOffer(accessToken, offerId, activeProfileId),
    onSuccess: (_data, offerId) => {
      void qc.invalidateQueries({ queryKey: ["marketplaceMyOffers"] });
      const row = q.data?.find((r) => r.id === offerId);
      if (row) {
        void qc.invalidateQueries({
          queryKey: ["marketplaceListing", row.listing.id]
        });
      }
    },
    onError: (e: Error) =>
      Alert.alert(
        "Impossible de retirer l’offre",
        marketplaceActionErrorMessage(e.message)
      )
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
        <RefreshControl
          refreshing={q.isFetching}
          onRefresh={() => void q.refetch()}
        />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Tu n&apos;as pas encore fait d&apos;offre.</Text>
      }
      renderItem={({ item }: { item: MarketplaceOfferMineRow }) => (
        <View style={styles.card}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("MarketplaceListingDetail", {
                listingId: item.listing.id,
                headline: item.listing.title
              })
            }
          >
            <Text style={styles.cardTitle}>{item.listing.title}</Text>
            <Text style={styles.price}>
              Mon offre : {formatMoney(item.offeredPrice, item.listing.currency)}
              {item.quantity != null ? ` × ${item.quantity}` : ""}
            </Text>
            <Text style={styles.meta}>
              Statut offre : {offerStatusLabel(item.status)}
            </Text>
            <Text style={styles.meta}>
              Annonce : {listingStatusLabel(item.listing.status)}
            </Text>
            {item.listing.farm ? (
              <Text style={styles.meta}>{item.listing.farm.name}</Text>
            ) : null}
            <Text style={styles.link}>Voir l&apos;annonce →</Text>
          </TouchableOpacity>
          {item.status === "pending" ? (
            <TouchableOpacity
              style={[
                styles.withdraw,
                withdrawMut.isPending && styles.withdrawDisabled
              ]}
              disabled={withdrawMut.isPending}
              onPress={() =>
                Alert.alert(
                  "Retirer cette offre ?",
                  "Tu pourras en soumettre une nouvelle plus tard si l’annonce est toujours publiée.",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Retirer",
                      style: "destructive",
                      onPress: () => withdrawMut.mutate(item.id)
                    }
                  ]
                )
              }
            >
              <Text style={styles.withdrawTxt}>Retirer mon offre</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16,
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
    marginTop: 4,
    fontSize: 13,
    color: "#6d745b"
  },
  link: {
    marginTop: 10,
    fontSize: 14,
    color: "#5d7a1f",
    fontWeight: "600"
  },
  withdraw: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#8b4513"
  },
  withdrawDisabled: {
    opacity: 0.55
  },
  withdrawTxt: {
    color: "#8b4513",
    fontWeight: "700",
    fontSize: 14
  }
});
