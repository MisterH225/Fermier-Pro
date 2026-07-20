import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { ListingModal } from "../components/marketplace/ListingModal";
import { MarketplaceBrowseListings } from "../components/marketplace/MarketplaceBrowseListings";
import { HealthVerifyCtaBanner } from "../components/marketplace/HealthVerifyCtaBanner";
import {
  healthVerifiedDaysAgo,
  MarketplaceListingCard,
  MarketplaceListingCardSkeleton
} from "../components/marketplace/MarketplaceListingCard";
import { OrdersHubView } from "../components/orders";
import { EmptyStateCard } from "../components/common/EmptyStateCard";
import { EventList, type EventItem } from "../components/lists";
import { EventListFilter } from "../components/lists/EventListFilter";
import type { FilterPill } from "../components/lists/types";
import { TabContent, TabSelector } from "../components/tabs";
import { useScrollBottomPad } from "../hooks/useScrollBottomPad";
import { useSession } from "../context/SessionContext";
import type { MarketplaceListingListItem } from "../lib/api";
import { useActiveProject } from "../context/ActiveProjectContext";
import {
  PropositionsScreen,
  type ProposalsSubTab
} from "./market/PropositionsScreen";
import { MarketplacePartnersTab } from "./market/tabs/MarketplacePartnersTab";
import { MarketplacePricesTab } from "./market/tabs/MarketplacePricesTab";
import {
  addBuyerFavorite,
  addBuyerMerchantFavorite,
  fetchBuyerFavoriteIds,
  fetchBuyerFavorites,
  fetchMarketplaceListingCategories,
  fetchMarketplaceListings,
  fetchMarketplaceOfferCounts,
  fetchMarketplaceOrdersCounters,
  removeBuyerFavorite,
  removeBuyerMerchantFavorite,
  type BuyerFavoriteListingDto
} from "../lib/api";
import {
  listingStatusLabel
} from "../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import { buyerColors, buyerStackScreenOptions } from "../theme/buyerTheme";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "MarketplaceList">;

type MarketTab = "listings" | "prices" | "mine" | "offers" | "partners" | "sales";
type CatKey = string;
type ListingFilter = "all" | "draft" | "published" | "sold" | "cancelled";

const PILL_ACTIVE = mobileColors.accent;

const MY_LISTING_FILTER_PILLS: FilterPill[] = [
  { id: "all", label: "Toutes" },
  { id: "draft", label: "Brouillons" },
  { id: "published", label: "Publiées" },
  { id: "sold", label: "Vendues" },
  { id: "cancelled", label: "Annulées" }
];

function parseNum(v: string | number | null | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n: number, currency: string): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency}`;
}

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

function isNewListing(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const t = new Date(publishedAt).getTime();
  return Date.now() - t < 48 * 60 * 60 * 1000;
}

function categoryLabel(cat: string | null | undefined): string {
  switch (cat) {
    case "piglet":
      return "Porcelet";
    case "breeder":
      return "Reproducteur";
    case "butcher":
      return "Charcutier";
    case "reformed":
      return "Truie réformée";
    default:
      return "Lot";
  }
}

function initialMarketTab(
  param?: RootStackParamList["MarketplaceList"]
): MarketTab {
  const tab = param && "tab" in param ? param.tab : undefined;
  if (
    tab === "mine" ||
    tab === "offers" ||
    tab === "listings" ||
    tab === "prices" ||
    tab === "partners" ||
    tab === "sales"
  ) {
    return tab;
  }
  return "listings";
}

function initialOffersSubTab(
  param?: RootStackParamList["MarketplaceList"]
): ProposalsSubTab {
  const sub = param && "offersSubTab" in param ? param.offersSubTab : undefined;
  return sub === "sent" ? "sent" : "received";
}

export function MarketplaceListScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const { activeFarmId } = useActiveProject();
  const qc = useQueryClient();

  const buyerView = route.params?.buyerView === true;
  const merchantView = route.params?.merchantView === true;
  const marketBrowseAsBuyer = buyerView || merchantView;
  const fromDashboard = route.params?.fromDashboard === true;
  const favoritesOnly = route.params?.favoritesOnly === true;
  const scrollBottomPad = useScrollBottomPad();
  const [marketTab, setMarketTab] = useState<MarketTab>(() => {
    const tab = initialMarketTab(route.params);
    if (marketBrowseAsBuyer && (tab === "mine" || tab === "sales")) {
      return "listings";
    }
    return tab;
  });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CatKey>("all");
  const isBuyerProfile =
    authMe?.profiles.find((p) => p.id === activeProfileId)?.type === "buyer";

  const favoriteIdsQ = useQuery({
    queryKey: ["buyerFavoriteIds", activeProfileId],
    queryFn: () => fetchBuyerFavoriteIds(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && isBuyerProfile && clientFeatures.marketplace)
  });

  const listingCategoriesQ = useQuery({
    queryKey: ["marketplaceListingCategories", activeProfileId],
    queryFn: () => fetchMarketplaceListingCategories(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && clientFeatures.marketplace)
  });

  const favoriteListingIdSet = useMemo(
    () => new Set(favoriteIdsQ.data?.listingIds ?? []),
    [favoriteIdsQ.data?.listingIds]
  );
  const favoriteProductIdSet = useMemo(
    () => new Set(favoriteIdsQ.data?.productIds ?? []),
    [favoriteIdsQ.data?.productIds]
  );
  const [myFilter, setMyFilter] = useState<ListingFilter>("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [offersSubTab, setOffersSubTab] = useState<ProposalsSubTab>(() =>
    initialOffersSubTab(route.params)
  );
  const offersListingFilter =
    route.params && "offersListingId" in route.params
      ? route.params.offersListingId
      : undefined;
  const highlightOfferId =
    route.params && "highlightOfferId" in route.params
      ? route.params.highlightOfferId
      : undefined;

  const routeTab =
    route.params && "tab" in route.params ? route.params.tab : undefined;
  const routeOffersSubTab =
    route.params && "offersSubTab" in route.params
      ? route.params.offersSubTab
      : undefined;

  useEffect(() => {
    const tab = initialMarketTab(route.params);
    if (marketBrowseAsBuyer && (tab === "mine" || tab === "sales")) {
      setMarketTab("listings");
      return;
    }
    setMarketTab(tab);
  }, [routeTab, marketBrowseAsBuyer]);

  useEffect(() => {
    setOffersSubTab(initialOffersSubTab(route.params));
  }, [routeOffersSubTab]);

  useEffect(() => {
    const q = route.params?.searchQuery;
    if (typeof q === "string" && q.trim()) {
      setSearch(q.trim());
    }
  }, [route.params?.searchQuery]);

  const cardW = useMemo(
    () => Math.floor((width - mobileSpacing.lg * 6) / 2),
    [width]
  );

  const qTrim = search.trim();
  const searchParam = qTrim.length >= 2 ? qTrim : undefined;

  const favoritesListQuery = useQuery({
    queryKey: ["buyerFavoritesList", activeProfileId],
    queryFn: () => fetchBuyerFavorites(accessToken!, activeProfileId),
    enabled:
      clientFeatures.marketplace &&
      Boolean(isBuyerProfile && favoritesOnly && accessToken)
  });

  /** Liste annonces buyerView : déléguée à MarketplaceBrowseListings. */
  const useSharedBrowseListings = marketBrowseAsBuyer && !favoritesOnly;

  const listingsQuery = useQuery({
    queryKey: ["marketplaceListings", activeProfileId, category, searchParam],
    queryFn: () =>
      fetchMarketplaceListings(accessToken!, activeProfileId, {
        mine: false,
        ...(category !== "all" ? { category } : {}),
        ...(searchParam ? { q: searchParam } : {})
      }),
    enabled:
      clientFeatures.marketplace &&
      marketTab === "listings" &&
      !favoritesOnly &&
      !useSharedBrowseListings
  });

  const myListingsQuery = useQuery({
    queryKey: ["marketplaceMyListings", activeProfileId, myFilter],
    queryFn: () =>
      fetchMarketplaceListings(accessToken!, activeProfileId, {
        mine: true,
        ...(myFilter !== "all" ? { status: myFilter } : {})
      }),
    enabled: clientFeatures.marketplace && marketTab === "mine"
  });

  const offerCountsQ = useQuery({
    queryKey: ["marketplaceOffersCounts", activeProfileId, activeFarmId],
    queryFn: () =>
      fetchMarketplaceOfferCounts(accessToken!, activeProfileId, activeFarmId),
    enabled: clientFeatures.marketplace && Boolean(accessToken)
  });

  const salesCountersQ = useQuery({
    queryKey: ["marketplace-orders-counters", "seller", activeProfileId],
    queryFn: () =>
      fetchMarketplaceOrdersCounters(accessToken!, "seller", activeProfileId),
    enabled:
      clientFeatures.marketplace &&
      Boolean(accessToken) &&
      !marketBrowseAsBuyer
  });

  useLayoutEffect(() => {
    const backToDashboard = () =>
      navigation.navigate(merchantView ? "MerchantDashboard" : "BuyerDashboard");

    navigation.setOptions({
      ...(buyerView ? buyerStackScreenOptions : {}),
      title: merchantView
        ? t("merchant.nav.marketplace")
        : buyerView
          ? t("buyer.nav.market")
          : "Market",
      headerLeft:
        fromDashboard
          ? () => (
              <TouchableOpacity
                onPress={backToDashboard}
                style={styles.headerBackBtn}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t("buyer.backToHome")}
              >
                <Ionicons
                  name="chevron-back"
                  size={22}
                  color={buyerView ? buyerColors.primary : mobileColors.accent}
                />
                <Text
                  style={[
                    styles.headerBackTx,
                    buyerView && { color: buyerColors.primary }
                  ]}
                >
                  {t("buyer.backToHome")}
                </Text>
              </TouchableOpacity>
            )
          : undefined,
      headerRight: () =>
        clientFeatures.marketplace && !marketBrowseAsBuyer ? (
          <TouchableOpacity
            onPress={() => setCreateModalOpen(true)}
            style={styles.headerActionRow}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("marketScreen.create")}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={mobileColors.accent}
            />
            <Text style={styles.headerAction}>{t("marketScreen.create")}</Text>
          </TouchableOpacity>
        ) : undefined
    });
  }, [navigation, clientFeatures.marketplace, t, buyerView, merchantView, fromDashboard]);

  const categoryPills: FilterPill[] = useMemo(() => {
    const groups = listingCategoriesQ.data;
    const allPill = { id: "all", label: t("marketScreen.categories.all") };
    if (!groups) {
      return [allPill];
    }
    return [
      allPill,
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
    onError: (e: Error) => Alert.alert("Favoris", getUserFacingError(e, t))
  });

  const toggleFav = (item: MarketplaceListingListItem) => {
    if (!isBuyerProfile || !accessToken) {
      return;
    }
    const kind = item.kind === "merchant" ? "merchant" : "listing";
    const isFav =
      kind === "merchant"
        ? favoriteProductIdSet.has(item.id)
        : favoriteListingIdSet.has(item.id);
    favMut.mutate({ id: item.id, kind, remove: isFav });
  };

  const renderListingCard = ({ item }: { item: MarketplaceListingListItem }) => {
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
        onPress={() =>
          isMerchant
            ? navigation.navigate("MerchantProductDetail", { productId: item.id })
            : navigation.navigate("MarketplaceListingDetail", {
                listingId: item.id,
                headline: item.title
              })
        }
      />
    );
  };

  const myRows = myListingsQuery.data ?? [];

  const myKpis = useMemo(() => {
    let views = 0;
    let consults = 0;
    for (const r of myRows) {
      views += r.viewsCount ?? 0;
      consults += r.consultationsCount ?? 0;
    }
    return { views, consults, n: myRows.length };
  }, [myRows]);

  /** Annonce publiée sans certificat santé valide → CTA acquisition véto. */
  const healthVerifyTarget = useMemo(() => {
    const row = myRows.find(
      (r) =>
        r.status === "published" &&
        r.farm?.id &&
        healthVerifiedDaysAgo(r.healthVerifiedAt) == null
    );
    if (!row?.farm) return null;
    return { farmId: row.farm.id, farmName: row.farm.name };
  }, [myRows]);

  const myEventItems = useMemo((): EventItem[] => {
    return myRows.map((item) => {
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
        iconType:
          item.status === "sold" ? "out" : item.status === "published" ? "in" : "check",
        meta: item
      };
    });
  }, [myRows]);

  const listingsErr =
    listingsQuery.error instanceof Error
      ? getUserFacingError(listingsQuery.error, t)
      : listingsQuery.error
        ? String(listingsQuery.error)
        : null;

  const favoritesAsListings = useMemo((): MarketplaceListingListItem[] => {
    return (favoritesListQuery.data ?? []).map((f: BuyerFavoriteListingDto) => {
      const isMerchant = f.kind === "merchant";
      return {
        id: f.id,
        kind: isMerchant ? ("merchant" as const) : ("listing" as const),
        title: f.title,
        description: null,
        unitPrice: isMerchant ? f.totalPrice : null,
        quantity: null,
        stock: f.stock ?? null,
        currency: f.currency?.trim() || "XOF",
        locationLabel: null,
        status: "published",
        publishedAt: f.publishedAt,
        createdAt: f.favoritedAt,
        updatedAt: f.favoritedAt,
        category: f.category,
        photoUrls: Array.isArray(f.photoUrls)
          ? (f.photoUrls as string[])
          : [],
        totalWeightKg: f.weightKg,
        pricePerKg: f.pricePerKg,
        totalPrice: f.totalPrice,
        farm: f.farmName ? { id: "", name: f.farmName } : null,
        animal: null
      };
    });
  }, [favoritesListQuery.data]);

  const listingsList = favoritesOnly ? favoritesAsListings : (listingsQuery.data ?? []);
  const listingsEmpty =
    listingsList.length === 0
      ? t("marketScreen.emptyListings")
      : t("marketScreen.emptySearch");

  const listingsTabContent = () => {
    if (useSharedBrowseListings) {
      return (
        <MarketplaceBrowseListings
          enabled={marketTab === "listings"}
          buyerTheme={buyerView}
          contentPaddingBottom={scrollBottomPad}
          initialSearch={
            typeof route.params?.searchQuery === "string"
              ? route.params.searchQuery
              : ""
          }
        />
      );
    }
    if (listingsQuery.isPending && !listingsQuery.data) {
      return (
        <View style={[styles.listingsPane, styles.skeletonGrid, { paddingHorizontal: mobileSpacing.lg }]}>
          {[0, 1, 2, 3].map((i) => (
            <MarketplaceListingCardSkeleton key={i} width={cardW} />
          ))}
        </View>
      );
    }
    if (listingsErr) {
      return (
        <View style={styles.tabCentered}>
          <Text style={styles.error}>{listingsErr}</Text>
        </View>
      );
    }
    const listingsHeader = (
      <View style={styles.listHeader}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder={t("marketScreen.searchPlaceholder")}
            placeholderTextColor={mobileColors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.filterRow}>
          <EventListFilter
            pills={categoryPills}
            activeId={category}
            onChange={(id) => setCategory(id as CatKey)}
            activeBackground={PILL_ACTIVE}
          />
        </View>
      </View>
    );

    return (
      <View style={styles.listingsPane}>
        <FlatList
          style={styles.listingsList}
          data={listingsList}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.colWrap}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: scrollBottomPad }
          ]}
          ListHeaderComponent={listingsHeader}
          refreshControl={
            <RefreshControl
              refreshing={favoritesOnly ? favoritesListQuery.isFetching : listingsQuery.isFetching}
              onRefresh={() => void (favoritesOnly ? favoritesListQuery.refetch() : listingsQuery.refetch())}
              tintColor={mobileColors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyStateCard
              title={listingsEmpty}
              subtitle={
                favoritesOnly
                  ? undefined
                  : t("marketScreen.emptyListingsHint")
              }
            />
          }
          renderItem={renderListingCard}
        />
      </View>
    );
  };

  const myListingsTabContent = () => {
    const err =
      myListingsQuery.error instanceof Error
        ? getUserFacingError(myListingsQuery.error, t)
        : myListingsQuery.error
          ? String(myListingsQuery.error)
          : null;
    if (myListingsQuery.isPending && !myListingsQuery.data) {
      return (
        <View style={styles.tabCentered}>
          <ActivityIndicator size="large" color={mobileColors.accent} />
        </View>
      );
    }
    if (err) {
      return (
        <View style={styles.tabCentered}>
          <Text style={styles.error}>{err}</Text>
        </View>
      );
    }
    const emptyMessage =
      myFilter === "all"
        ? t("marketScreen.emptyMyListings")
        : t("marketScreen.emptyMyFilter");
    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={[
          styles.tabScrollGrow,
          { paddingBottom: scrollBottomPad }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={myListingsQuery.isFetching}
            onRefresh={() => void myListingsQuery.refetch()}
            tintColor={mobileColors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <TabContent>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{myKpis.n}</Text>
              <Text style={styles.kpiLab}>{t("marketScreen.kpiListings")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{myKpis.views}</Text>
              <Text style={styles.kpiLab}>{t("marketScreen.kpiViews")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{myKpis.consults}</Text>
              <Text style={styles.kpiLab}>{t("marketScreen.kpiConsults")}</Text>
            </View>
          </View>
          <HealthVerifyCtaBanner
            userId={authMe?.user.id}
            visible={Boolean(healthVerifyTarget)}
            onPressCta={() => {
              if (!healthVerifyTarget) return;
              navigation.navigate("VetSearch", {
                farmId: healthVerifyTarget.farmId,
                farmName: healthVerifyTarget.farmName
              });
            }}
          />
          <EventList
            layout="embedded"
            data={myEventItems}
            filters={MY_LISTING_FILTER_PILLS}
            activeFilterId={myFilter}
            onFilterChange={(id) => setMyFilter(id as ListingFilter)}
            emptyMessage={emptyMessage}
            onItemPress={(it) => {
              const item = it.meta as MarketplaceListingListItem;
              navigation.navigate("MarketplaceListingDetail", {
                listingId: item.id,
                headline: item.title
              });
            }}
          />
        </TabContent>
      </ScrollView>
    );
  };

  const offersTabContent = () => (
    <PropositionsScreen
      navigation={navigation}
      contentPaddingBottom={scrollBottomPad}
      initialSubTab={offersSubTab}
      listingIdFilter={offersListingFilter}
      highlightOfferId={highlightOfferId}
      buyerSentOnly={marketBrowseAsBuyer}
    />
  );

  const salesTabContent = () => (
    <OrdersHubView
      role="seller"
      initialSegment={route.params?.ordersSegment ?? "action_required"}
      contentContainerStyle={{ paddingBottom: scrollBottomPad }}
    />
  );

  const partnersTabContent = () => (
    <MarketplacePartnersTab
      navigation={navigation}
      role={marketBrowseAsBuyer ? "buyer" : "seller"}
      buyerView={buyerView}
      contentPaddingBottom={scrollBottomPad}
    />
  );

  const pricesTabContent = () => (
    <MarketplacePricesTab contentPaddingBottom={scrollBottomPad} />
  );

  const offersTabBadge = marketBrowseAsBuyer
    ? offerCountsQ.data?.sentPending ?? 0
    : offerCountsQ.data?.total ?? 0;
  const salesTabBadge = salesCountersQ.data?.actionRequired ?? 0;

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  return (
    <MarketplaceModuleGate>
      <View style={styles.root} testID="marketplace-list-screen">
        {marketBrowseAsBuyer ? (
          <TabSelector
            testIDPrefix="market-tab"
            activeTab={marketTab}
            onTabChange={(key) => setMarketTab(key as MarketTab)}
            tabs={[
              {
                key: "listings",
                label: t("marketScreen.tabListings"),
                content: listingsTabContent()
              },
              {
                key: "prices",
                label: t("marketScreen.tabPrices"),
                content: pricesTabContent()
              },
              {
                key: "offers",
                label: t("marketScreen.proposals.tabSent"),
                badge: offersTabBadge > 0 ? offersTabBadge : undefined,
                content: offersTabContent()
              },
              {
                key: "partners",
                label: t("marketScreen.tabSuppliers"),
                content: partnersTabContent()
              }
            ]}
          />
        ) : (
          <TabSelector
            testIDPrefix="market-tab"
            activeTab={marketTab}
            onTabChange={(key) => setMarketTab(key as MarketTab)}
            tabs={[
              {
                key: "listings",
                label: t("marketScreen.tabListings"),
                content: listingsTabContent()
              },
              {
                key: "prices",
                label: t("marketScreen.tabPrices"),
                content: pricesTabContent()
              },
              {
                key: "mine",
                label: t("marketScreen.tabMyListings"),
                content: myListingsTabContent()
              },
              {
                key: "offers",
                label: t("marketScreen.tabOffers"),
                badge: offersTabBadge > 0 ? offersTabBadge : undefined,
                content: offersTabContent()
              },
              {
                key: "sales",
                label: t("marketScreen.tabSales"),
                badge: salesTabBadge > 0 ? salesTabBadge : undefined,
                content: salesTabContent()
              },
              {
                key: "partners",
                label: t("marketScreen.tabClients"),
                content: partnersTabContent()
              }
            ]}
          />
        )}
      </View>
      <ListingModal
        visible={createModalOpen}
        mode="create"
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(created) =>
          navigation.navigate("MarketplaceListingDetail", {
            listingId: created.id,
            headline: created.title
          })
        }
      />
    </MarketplaceModuleGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  headerAction: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: 15
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4
  },
  headerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
    gap: 2
  },
  headerBackTx: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: 16
  },
  tabCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg
  },
  tabScroll: { flex: 1 },
  tabScrollGrow: { flexGrow: 1 },
  listingsPane: {
    flex: 1,
    minHeight: 0
  },
  listingsList: { flex: 1 },
  listHeader: {
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.xs,
    gap: mobileSpacing.sm
  },
  filterRow: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: mobileSpacing.lg
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg
  },
  search: {
    flex: 1,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  filterAdv: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  filterAdvTx: { fontSize: 20 },
  colWrap: {
    justifyContent: "space-between",
    marginBottom: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.lg
  },
  listContent: {},
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: mobileSpacing.md,
    paddingTop: mobileSpacing.sm
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: mobileSpacing.xl,
    paddingHorizontal: mobileSpacing.lg
  },
  error: {
    color: mobileColors.error,
    ...mobileTypography.body,
    textAlign: "center"
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: 16,
    overflow: "hidden",
    ...mobileShadows.card
  },
  photoWrap: {
    position: "relative",
    height: 140,
    backgroundColor: mobileColors.surfaceMuted
  },
  photo: {
    width: "100%",
    height: 140,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16
  },
  photoPh: {
    alignItems: "center",
    justifyContent: "center"
  },
  photoPhTx: { fontSize: 36, opacity: 0.35 },
  badgeCat: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  badgeCatTx: {
    color: mobileColors.onAccent,
    fontSize: 11,
    fontWeight: "700"
  },
  badgeNew: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: PILL_ACTIVE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeNewTx: { color: mobileColors.onAccent, fontSize: 10, fontWeight: "800" },
  favBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,215,128,0.95)",
    alignItems: "center",
    justifyContent: "center"
  },
  favTx: { fontSize: 16 },
  cardBody: {
    padding: mobileSpacing.sm
  },
  lineMuted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  totalLine: {
    ...mobileTypography.body,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  statsTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  kpiRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  kpiCard: {
    flex: 1,
    backgroundColor: mobileColors.background,
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
  offersList: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md
  },
  offerCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  offerTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  offerPrice: {
    marginTop: mobileSpacing.sm,
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.accent
  },
  offerMeta: {
    marginTop: 4,
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  offerLink: {
    marginTop: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  withdraw: {
    marginTop: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    alignItems: "center",
    borderRadius: mobileRadius.md,
    borderWidth: 2,
    borderColor: mobileColors.warning
  },
  withdrawDisabled: { opacity: 0.55 },
  withdrawTxt: {
    color: mobileColors.warning,
    fontWeight: "700",
    fontSize: 14
  }
});
