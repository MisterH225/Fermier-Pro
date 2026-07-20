import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BuyerAlertsPanel } from "../../components/buyer/BuyerAlertsPanel";
import { BuyerFavoritesPanel } from "../../components/buyer/BuyerFavoritesPanel";
import { MarketplaceListingCard } from "../../components/marketplace/MarketplaceListingCard";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBottomChromePad, useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  fetchBuyerDashboard,
  fetchBuyerFavoriteIds,
  fetchBuyerPersonalizedListings,
  fetchMarketplaceListings,
  type MarketplaceListingListItem
} from "../../lib/api";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "BuyerMarket">;
type Segment = "listings" | "favorites" | "alerts";

function listingFromPreview(
  item: Awaited<ReturnType<typeof fetchBuyerPersonalizedListings>>[number]
): MarketplaceListingListItem {
  return {
    id: item.id,
    title: item.title,
    description: null,
    unitPrice: null,
    quantity: null,
    currency: "XOF",
    locationLabel: null,
    status: "published",
    publishedAt: item.publishedAt,
    createdAt: item.publishedAt ?? new Date().toISOString(),
    updatedAt: item.publishedAt ?? new Date().toISOString(),
    category: item.category,
    photoUrls: Array.isArray(item.photoUrls)
      ? (item.photoUrls as string[])
      : null,
    pricePerKg: item.pricePerKg,
    totalPrice: item.totalPrice,
    totalWeightKg: item.weightKg,
    farm: item.farmName ? { id: "", name: item.farmName } : null,
    animal: null
  };
}

export function BuyerMarketScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const bottomInset = useBottomInset();
  const bottomChromePad = useBottomChromePad();
  const { accessToken, activeProfileId } = useSession();

  const initialSegment: Segment =
    route.params?.segment === "favorites" ||
    route.params?.segment === "alerts" ||
    route.params?.segment === "listings"
      ? route.params.segment
      : route.params?.favoritesOnly
        ? "favorites"
        : "listings";

  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [search, setSearch] = useState(route.params?.searchQuery ?? "");
  const [category, setCategory] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState("");
  const [radiusKm, setRadiusKm] = useState("");

  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
    else if (route.params?.favoritesOnly) setSegment("favorites");
  }, [route.params?.segment, route.params?.favoritesOnly]);

  const profileQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId, "marketFilters"],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useEffect(() => {
    const p = profileQ.data?.profile;
    if (!p) return;
    if (!radiusKm && p.searchRadiusKm != null) {
      setRadiusKm(String(p.searchRadiusKm));
    }
    if (!maxPrice && p.priceRangeMax) {
      setMaxPrice(p.priceRangeMax);
    }
    if (!category && p.preferredCategories?.[0]) {
      setCategory(p.preferredCategories[0]);
    }
  }, [profileQ.data?.profile, radiusKm, maxPrice, category]);

  const listingsQ = useQuery({
    queryKey: [
      "buyerMarketListings",
      activeProfileId,
      search,
      category,
      maxPrice
    ],
    queryFn: async () => {
      const personalized = await fetchBuyerPersonalizedListings(
        accessToken!,
        activeProfileId
      );
      if (personalized.length > 0 && !search.trim() && !category) {
        return personalized.map(listingFromPreview);
      }
      return fetchMarketplaceListings(accessToken!, activeProfileId, {
        q: search.trim() || undefined,
        category: category ?? undefined
      });
    },
    enabled: Boolean(accessToken && segment === "listings")
  });

  const favIdsQ = useQuery({
    queryKey: ["buyerFavoriteIds", activeProfileId],
    queryFn: () => fetchBuyerFavoriteIds(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && segment === "listings")
  });

  const favoriteSet = useMemo(
    () => new Set(favIdsQ.data?.listingIds ?? []),
    [favIdsQ.data?.listingIds]
  );

  const filteredListings = useMemo(() => {
    let rows = listingsQ.data ?? [];
    const max = maxPrice.trim() ? Number(maxPrice) : NaN;
    if (Number.isFinite(max)) {
      rows = rows.filter((r) => {
        const p = r.pricePerKg != null ? Number(r.pricePerKg) : NaN;
        return !Number.isFinite(p) || p <= max;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.farm?.name ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [listingsQ.data, maxPrice, search]);

  const cardWidth = useMemo(() => {
    const screenW = Dimensions.get("window").width;
    return Math.floor((screenW - mobileSpacing.md * 2 - mobileSpacing.sm) / 2);
  }, []);

  const segments: { id: Segment; label: string }[] = [
    { id: "listings", label: t("buyer.market.segmentListings") },
    { id: "favorites", label: t("buyer.market.segmentFavorites") },
    { id: "alerts", label: t("buyer.market.segmentAlerts") }
  ];

  return (
    <BuyerMobileShell>
      <View style={[styles.wrap, { paddingBottom: bottomChromePad }]}>
        <View style={styles.segments}>
          {segments.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.seg, segment === s.id && styles.segOn]}
              onPress={() => setSegment(s.id)}
            >
              <Text style={[styles.segTx, segment === s.id && styles.segTxOn]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {segment === "listings" ? (
          <>
            <View style={styles.searchRow}>
              <Ionicons
                name="search"
                size={18}
                color={buyerColors.textSecondary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={t("buyer.market.searchPlaceholder")}
                placeholderTextColor={buyerColors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <View style={styles.filters}>
              <TextInput
                style={styles.filterInput}
                placeholder={t("buyer.market.filterMaxPrice")}
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
              <TextInput
                style={styles.filterInput}
                placeholder={t("buyer.market.filterRadius")}
                keyboardType="numeric"
                value={radiusKm}
                onChangeText={setRadiusKm}
              />
            </View>
            {profileQ.data?.profile?.preferredCategories?.length ? (
              <View style={styles.catRow}>
                <Pressable
                  style={[styles.catChip, !category && styles.catChipOn]}
                  onPress={() => setCategory(null)}
                >
                  <Text
                    style={[styles.catTx, !category && styles.catTxOn]}
                  >
                    {t("buyer.market.allCategories")}
                  </Text>
                </Pressable>
                {profileQ.data.profile.preferredCategories.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.catChip, category === c && styles.catChipOn]}
                    onPress={() => setCategory(c)}
                  >
                    <Text
                      style={[
                        styles.catTx,
                        category === c && styles.catTxOn
                      ]}
                    >
                      {t(`buyerOnboarding.cat.${c}`, { defaultValue: c })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {listingsQ.isLoading ? (
              <ActivityIndicator
                color={buyerColors.primary}
                style={{ marginTop: mobileSpacing.lg }}
              />
            ) : (
              <FlatList
                data={filteredListings}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.cols}
                contentContainerStyle={{
                  paddingBottom: bottomInset,
                  gap: mobileSpacing.sm
                }}
                refreshControl={
                  <RefreshControl
                    refreshing={listingsQ.isFetching && !listingsQ.isLoading}
                    onRefresh={() => void listingsQ.refetch()}
                    tintColor={buyerColors.primary}
                  />
                }
                ListEmptyComponent={
                  <Text style={styles.empty}>{t("buyer.market.emptyListings")}</Text>
                }
                renderItem={({ item }) => (
                  <MarketplaceListingCard
                    item={item}
                    width={cardWidth}
                    onPress={() =>
                      navigation.navigate("MarketplaceListingDetail", {
                        listingId: item.id,
                        headline: item.title
                      })
                    }
                    showFavorite
                    isFavorite={favoriteSet.has(item.id)}
                    navigation={navigation}
                    showShare
                  />
                )}
              />
            )}
          </>
        ) : null}

        {segment === "favorites" ? (
          <View style={styles.panelPad}>
            <BuyerFavoritesPanel onExplore={() => setSegment("listings")} />
          </View>
        ) : null}

        {segment === "alerts" ? (
          <View style={styles.panelPad}>
            <BuyerAlertsPanel showFab={false} />
          </View>
        ) : null}
      </View>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: mobileSpacing.md },
  segments: {
    flexDirection: "row",
    gap: 8,
    marginBottom: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  seg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: buyerRadius.pill,
    backgroundColor: buyerColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    alignItems: "center"
  },
  segOn: {
    backgroundColor: buyerColors.primary,
    borderColor: buyerColors.primary
  },
  segTx: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: buyerColors.textSecondary
  },
  segTxOn: { color: buyerColors.onPrimary, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.button,
    paddingHorizontal: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    marginBottom: mobileSpacing.sm
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: buyerColors.textPrimary
  },
  filters: { flexDirection: "row", gap: 8, marginBottom: mobileSpacing.sm },
  filterInput: {
    flex: 1,
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.button,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    color: buyerColors.textPrimary
  },
  catRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: mobileSpacing.sm
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: buyerColors.primaryLight
  },
  catChipOn: { backgroundColor: buyerColors.primary },
  catTx: { ...mobileTypography.meta, color: buyerColors.textSecondary },
  catTxOn: { color: buyerColors.onPrimary, fontWeight: "700" },
  cols: { justifyContent: "space-between", gap: mobileSpacing.sm },
  empty: {
    textAlign: "center",
    color: buyerColors.textSecondary,
    marginTop: mobileSpacing.xl
  },
  panelPad: { flex: 1, paddingTop: mobileSpacing.sm }
});
