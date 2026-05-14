import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { EventList, type EventItem } from "../components/lists";
import type { FilterPill } from "../components/lists/types";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { useSession } from "../context/SessionContext";
import type { MarketplaceListingListItem } from "../lib/api";
import { fetchMarketplaceListings } from "../lib/api";
import { listingStatusLabel } from "../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MarketplaceMyListings">;

type ListingFilter = "all" | "draft" | "published" | "sold" | "cancelled";

const FILTER_PILLS: FilterPill[] = [
  { id: "all", label: "Toutes" },
  { id: "draft", label: "Brouillons" },
  { id: "published", label: "Publiées" },
  { id: "sold", label: "Vendues" },
  { id: "cancelled", label: "Annulées" }
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

  const rows = q.data ?? [];

  const kpis = useMemo(() => {
    let views = 0;
    let consults = 0;
    for (const r of rows) {
      views += r.viewsCount ?? 0;
      consults += r.consultationsCount ?? 0;
    }
    return { views, consults, n: rows.length };
  }, [rows]);

  const eventItems = useMemo((): EventItem[] => {
    return rows.map((item) => {
      const statusLab = listingStatusLabel(item.status);
      const farm = item.farm?.name;
      const priceLine =
        item.totalPrice != null
          ? `${typeof item.totalPrice === "string" ? item.totalPrice : String(item.totalPrice)} ${item.currency}`
          : formatPrice(item.unitPrice, item.currency);
      return {
        id: item.id,
        title: item.title,
        subtitle: [statusLab, farm].filter(Boolean).join(" · "),
        value: priceLine,
        valueType: "neutral",
        date: new Date(item.updatedAt).toLocaleDateString("fr-FR"),
        iconType: item.status === "sold" ? "out" : item.status === "published" ? "in" : "check",
        meta: item
      };
    });
  }, [rows]);

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
        <ActivityIndicator size="large" color={mobileColors.accent} />
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

  const emptyMessage =
    filter === "all"
      ? "Tu n'as pas encore d'annonce. Utilise « Créer » pour en ajouter une."
      : "Aucune annonce dans ce filtre.";

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />
        }
      >
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{kpis.n}</Text>
            <Text style={styles.kpiLab}>Annonces</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{kpis.views}</Text>
            <Text style={styles.kpiLab}>Vues</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{kpis.consults}</Text>
            <Text style={styles.kpiLab}>Consultations</Text>
          </View>
        </View>
        <EventList
          layout="embedded"
          data={eventItems}
          filters={FILTER_PILLS}
          activeFilterId={filter}
          onFilterChange={(id) => setFilter(id as ListingFilter)}
          emptyMessage={emptyMessage}
          onItemPress={(it) => {
            const item = it.meta as MarketplaceListingListItem;
            navigation.navigate("MarketplaceListingDetail", {
              listingId: item.id,
              headline: item.title
            });
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F5" },
  scroll: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl
  },
  kpiRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  kpiVal: {
    ...mobileTypography.cardTitle,
    fontSize: 18,
    color: mobileColors.textPrimary
  },
  kpiLab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
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
  }
});
