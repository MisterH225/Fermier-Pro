import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { EmptyStateCard } from "../common/EmptyStateCard";
import { EventListFilter } from "../lists/EventListFilter";
import type { FilterPill } from "../lists/types";
import { useSession } from "../../context/SessionContext";
import {
  addBuyerFavorite,
  addBuyerMerchantFavorite,
  fetchBuyerFavoriteIds,
  fetchMarketplaceListingCategories,
  fetchMarketplaceListings,
  removeBuyerFavorite,
  removeBuyerMerchantFavorite,
  type MarketplaceListingListItem
} from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import { buyerColors } from "../../theme/buyerTheme";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import {
  healthVerifiedDaysAgo,
  MarketplaceListingCard,
  MarketplaceListingCardSkeleton
} from "./MarketplaceListingCard";

const HEALTH_FILTER_ID = "health_verified";

type Props = {
  /** Désactive les fetches (ex. segment inactif). */
  enabled?: boolean;
  contentPaddingBottom?: number;
  initialSearch?: string;
  /** Thème violet acheteur vs accent producteur. */
  buyerTheme?: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyHint?: string;
};

/**
 * Liste d'annonces marketplace (recherche + catégories + cartes),
 * partagée entre MarketplaceList (buyerView) et BuyerMarket (segment Annonces).
 * Ne modifie pas MarketplaceListingCard.
 */
export function MarketplaceBrowseListings({
  enabled = true,
  contentPaddingBottom = 0,
  initialSearch = "",
  buyerTheme = false,
  searchPlaceholder,
  emptyTitle,
  emptyHint
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const qc = useQueryClient();

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState("all");

  const accent = buyerTheme ? buyerColors.primary : mobileColors.accent;
  const isBuyerProfile =
    authMe?.profiles.find((p) => p.id === activeProfileId)?.type === "buyer";

  const cardW = useMemo(
    () => Math.floor((width - mobileSpacing.lg * 6) / 2),
    [width]
  );

  const qTrim = search.trim();
  const searchParam = qTrim.length >= 2 ? qTrim : undefined;

  const favoriteIdsQ = useQuery({
    queryKey: ["buyerFavoriteIds", activeProfileId],
    queryFn: () => fetchBuyerFavoriteIds(accessToken!, activeProfileId),
    enabled: Boolean(
      enabled && accessToken && isBuyerProfile && clientFeatures.marketplace
    )
  });

  const listingCategoriesQ = useQuery({
    queryKey: ["marketplaceListingCategories", activeProfileId],
    queryFn: () =>
      fetchMarketplaceListingCategories(accessToken!, activeProfileId),
    enabled: Boolean(enabled && accessToken && clientFeatures.marketplace)
  });

  const apiCategory =
    category !== "all" && category !== HEALTH_FILTER_ID ? category : undefined;

  const listingsQuery = useQuery({
    queryKey: [
      "marketplaceListings",
      activeProfileId,
      apiCategory ?? "all",
      searchParam,
      "browse"
    ],
    queryFn: () =>
      fetchMarketplaceListings(accessToken!, activeProfileId, {
        mine: false,
        ...(apiCategory ? { category: apiCategory } : {}),
        ...(searchParam ? { q: searchParam } : {})
      }),
    enabled: Boolean(enabled && accessToken && clientFeatures.marketplace)
  });

  const favoriteListingIdSet = useMemo(
    () => new Set(favoriteIdsQ.data?.listingIds ?? []),
    [favoriteIdsQ.data?.listingIds]
  );
  const favoriteProductIdSet = useMemo(
    () => new Set(favoriteIdsQ.data?.productIds ?? []),
    [favoriteIdsQ.data?.productIds]
  );

  const categoryPills: FilterPill[] = useMemo(() => {
    const groups = listingCategoriesQ.data;
    const allPill = { id: "all", label: t("marketScreen.categories.all") };
    const healthPill = {
      id: HEALTH_FILTER_ID,
      label: t("marketScreen.filterHealthVerified")
    };
    if (!groups) return [allPill, healthPill];
    return [
      allPill,
      healthPill,
      ...groups.pig.map((p) => ({ id: p.id, label: p.label })),
      ...groups.merchant.map((p) => ({ id: p.id, label: p.label }))
    ];
  }, [listingCategoriesQ.data, t]);

  const favMut = useMutation({
    mutationFn: async ({
      id,
      kind,
      remove
    }: {
      id: string;
      kind: "listing" | "merchant";
      remove: boolean;
    }) => {
      if (kind === "merchant") {
        if (remove) {
          return removeBuyerMerchantFavorite(accessToken!, activeProfileId, id);
        }
        return addBuyerMerchantFavorite(accessToken!, activeProfileId, id);
      }
      if (remove) {
        return removeBuyerFavorite(accessToken!, activeProfileId, id);
      }
      return addBuyerFavorite(accessToken!, activeProfileId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["buyerFavoriteIds"] });
      void qc.invalidateQueries({ queryKey: ["buyerFavorites"] });
      void qc.invalidateQueries({ queryKey: ["buyerFavoritesList"] });
      void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
    },
    onError: (e: Error) =>
      Alert.alert(t("buyer.favorites.errorTitle"), getUserFacingError(e, t))
  });

  const toggleFav = (item: MarketplaceListingListItem) => {
    if (!isBuyerProfile || !accessToken) return;
    const kind = item.kind === "merchant" ? "merchant" : "listing";
    const isFav =
      kind === "merchant"
        ? favoriteProductIdSet.has(item.id)
        : favoriteListingIdSet.has(item.id);
    favMut.mutate({ id: item.id, kind, remove: isFav });
  };

  const listingsList = useMemo(() => {
    const rows = listingsQuery.data ?? [];
    if (category !== HEALTH_FILTER_ID) return rows;
    return rows.filter(
      (item) =>
        item.kind !== "merchant" &&
        healthVerifiedDaysAgo(item.healthVerifiedAt) != null
    );
  }, [listingsQuery.data, category]);
  const listingsErr =
    listingsQuery.error instanceof Error
      ? getUserFacingError(listingsQuery.error, t)
      : listingsQuery.error
        ? String(listingsQuery.error)
        : null;

  if (listingsQuery.isPending && !listingsQuery.data) {
    return (
      <View style={[styles.pane, styles.skeletonGrid]}>
        {[0, 1, 2, 3].map((i) => (
          <MarketplaceListingCardSkeleton key={i} width={cardW} />
        ))}
      </View>
    );
  }

  if (listingsErr) {
    return (
      <View style={styles.centered}>
        <Text
          style={[
            styles.error,
            {
              color: buyerTheme ? buyerColors.danger : mobileColors.error
            }
          ]}
        >
          {listingsErr}
        </Text>
      </View>
    );
  }

  const header = (
    <View style={styles.listHeader}>
      <View
        style={[
          styles.searchRow,
          buyerTheme && {
            backgroundColor: buyerColors.cardBg,
            borderColor: buyerColors.border
          }
        ]}
      >
        <TextInput
          style={[
            styles.search,
            buyerTheme && { color: buyerColors.textPrimary }
          ]}
          value={search}
          onChangeText={setSearch}
          placeholder={
            searchPlaceholder ?? t("marketScreen.searchPlaceholder")
          }
          placeholderTextColor={
            buyerTheme ? buyerColors.textMuted : mobileColors.textSecondary
          }
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <View style={styles.filterRow}>
        <EventListFilter
          pills={categoryPills}
          activeId={category}
          onChange={(id) => setCategory(id)}
          activeBackground={accent}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.pane}>
      <FlatList
        style={styles.list}
        data={listingsList}
        keyExtractor={(item) => `${item.kind ?? "listing"}:${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.colWrap}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: contentPaddingBottom }
        ]}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={listingsQuery.isFetching}
            onRefresh={() => void listingsQuery.refetch()}
            tintColor={accent}
          />
        }
        ListEmptyComponent={
          <EmptyStateCard
            title={emptyTitle ?? t("marketScreen.emptyListings")}
            subtitle={emptyHint ?? t("marketScreen.emptyListingsHint")}
          />
        }
        renderItem={({ item }) => {
          const isMerchant = item.kind === "merchant";
          const isFav = isMerchant
            ? favoriteProductIdSet.has(item.id)
            : favoriteListingIdSet.has(item.id);
          return (
            <MarketplaceListingCard
              item={item}
              width={cardW}
              showFavorite={isBuyerProfile}
              isFavorite={isFav}
              onToggleFavorite={() => toggleFav(item)}
              showShare
              navigation={navigation}
              viewerIsOwner={
                Boolean(authMe?.user.id) &&
                item.seller?.id === authMe?.user.id
              }
              onPress={() =>
                isMerchant
                  ? navigation.navigate("MerchantProductDetail", {
                      productId: item.id
                    })
                  : navigation.navigate("MarketplaceListingDetail", {
                      listingId: item.id,
                      headline: item.title
                    })
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  colWrap: { justifyContent: "space-between", gap: mobileSpacing.sm },
  listHeader: { gap: mobileSpacing.sm, marginBottom: mobileSpacing.sm },
  searchRow: {
    backgroundColor: mobileColors.background,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    paddingHorizontal: mobileSpacing.md
  },
  search: {
    ...mobileTypography.body,
    paddingVertical: 11,
    color: mobileColors.textPrimary
  },
  filterRow: { marginBottom: 4 },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    paddingTop: mobileSpacing.md
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.lg
  },
  error: { ...mobileTypography.body, textAlign: "center" }
});
