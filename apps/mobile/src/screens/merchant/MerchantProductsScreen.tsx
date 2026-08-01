import {
  useFocusEffect,
  useNavigation,
  useRoute
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { MerchantProductGridCard } from "../../components/merchant/MerchantProductGridCard";
import { MerchantProductsRestockSection } from "../../components/merchant/MerchantProductsRestockSection";
import { MerchantProductsSalesSection } from "../../components/merchant/MerchantProductsSalesSection";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { FeedIngredientIcon } from "../../components/merchant/FeedIngredientIcon";
import {
  deactivateMillIngredientOffer,
  deleteMerchantProduct,
  fetchMerchantMe,
  fetchMerchantProducts,
  fetchMerchantSellerOrders,
  fetchMillIngredientOffers,
  publishMerchantProduct,
  swapMerchantProductActive,
  unpublishMerchantProduct,
  updateMillIngredientOffer,
  type MerchantProductDto,
  type MillIngredientOfferDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { canAccessMillFeatures } from "../../lib/merchantKind";
import { hasMerchantShop } from "../../lib/merchantShop";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing, mobileColors, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type StatusFilter =
  | "all"
  | "published"
  | "disabled"
  | "draft"
  | "moderated_removed"
  | "resubmission_review";

type KindFilter = "all" | "ingredients" | "other";

const FILTERS: StatusFilter[] = [
  "all",
  "published",
  "disabled",
  "draft",
  "moderated_removed",
  "resubmission_review"
];
const GRID_GAP = mobileSpacing.sm;
const H_PAD = mobileSpacing.md;

export function MerchantProductsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MerchantProducts">>();
  const bottomInset = useBottomInset();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, platformModules } = useSession();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const initialKind = route.params?.kindFilter;
  const [kindFilter, setKindFilter] = useState<KindFilter>(
    initialKind === "ingredients" || initialKind === "other"
      ? initialKind
      : "all"
  );
  const [refreshing, setRefreshing] = useState(false);

  const cardWidth = useMemo(() => {
    const screenW = Dimensions.get("window").width;
    return Math.floor((screenW - H_PAD * 2 - GRID_GAP) / 2);
  }, []);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const millOk = canAccessMillFeatures(
    platformModules,
    meQ.data?.merchantKind
  );

  const productsQ = useQuery({
    queryKey: ["merchant-products", activeProfileId],
    queryFn: () => fetchMerchantProducts(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const offersQ = useQuery({
    queryKey: ["mill-offers", activeProfileId],
    queryFn: () => fetchMillIngredientOffers(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId && millOk)
  });

  const ordersQ = useQuery({
    queryKey: ["merchant-seller-orders", activeProfileId],
    queryFn: () => fetchMerchantSellerOrders(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const linkedProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const o of offersQ.data ?? []) {
      if (o.merchantProductId) ids.add(o.merchantProductId);
    }
    return ids;
  }, [offersQ.data]);

  const filteredOffers = useMemo(() => {
    const offers = (offersQ.data ?? []).filter((o) => o.isActive);
    if (filter === "all") return offers;
    return offers.filter((o) => {
      const status = o.merchantProductStatus;
      if (filter === "published") {
        return o.isPubliclyListed && (status === "published" || status == null);
      }
      if (filter === "draft") {
        return !o.isPubliclyListed || status === "draft";
      }
      if (filter === "disabled") {
        return status === "disabled";
      }
      return status === filter;
    });
  }, [offersQ.data, filter]);

  const filtered = useMemo(() => {
    let items = productsQ.data ?? [];
    if (millOk && (kindFilter === "other" || kindFilter === "all")) {
      // Évite le double affichage : les intrants publics liés passent par les cartes offre.
      items = items.filter((p) => !linkedProductIds.has(p.id));
    }
    if (millOk && kindFilter === "ingredients") {
      // Les intrants publics sont aussi des produits liés — on affiche la liste d'offres.
      return [];
    }
    if (filter === "all") return items;
    return items.filter((p) => p.status === filter);
  }, [productsQ.data, filter, millOk, kindFilter, linkedProductIds]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["merchant-products", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["mill-offers", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-me", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-dashboard", activeProfileId] });
    await queryClient.invalidateQueries({
      queryKey: ["merchant-seller-orders", activeProfileId]
    });
  }, [queryClient, activeProfileId]);

  const togglePublish = useMutation({
    mutationFn: async (product: MerchantProductDto) => {
      if (!accessToken || !activeProfileId) throw new Error("session");
      if (product.status === "published") {
        return unpublishMerchantProduct(accessToken, activeProfileId, product.id);
      }
      return publishMerchantProduct(accessToken, activeProfileId, product.id);
    },
    onSuccess: () => void invalidate(),
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const swapActive = useMutation({
    mutationFn: async (productId: string) => {
      if (!accessToken || !activeProfileId) throw new Error("session");
      return swapMerchantProductActive(accessToken, activeProfileId, productId);
    },
    onSuccess: () => void invalidate(),
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      if (!accessToken || !activeProfileId) throw new Error("session");
      return deleteMerchantProduct(accessToken, activeProfileId, productId);
    },
    onSuccess: () => void invalidate(),
    onError: (e) => {
      const msg = formatApiError(e);
      if (/PRODUCT_HAS_ACTIVE_ORDERS|commande/i.test(msg)) {
        Alert.alert(t("merchant.products.deleteBlocked"));
        return;
      }
      Alert.alert(msg);
    }
  });

  const confirmDelete = useCallback(
    (product: MerchantProductDto) => {
      Alert.alert(
        t("merchant.products.deleteTitle"),
        t("merchant.products.deleteBodyNamed", { name: product.name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("merchant.products.deleteConfirm"),
            style: "destructive",
            onPress: () => deleteProduct.mutate(product.id)
          }
        ]
      );
    },
    [deleteProduct, t]
  );

  useFocusEffect(
    useCallback(() => {
      const requested = route.params?.kindFilter;
      if (
        requested === "ingredients" ||
        requested === "other" ||
        requested === "all"
      ) {
        setKindFilter(requested);
        // Consommer le param pour ne pas réimposer le filtre à chaque focus.
        navigation.setParams({ kindFilter: undefined });
      }
      if (!activeProfileId) return;
      void queryClient.invalidateQueries({
        queryKey: ["merchant-me", activeProfileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["merchant-products", activeProfileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["mill-offers", activeProfileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["merchant-seller-orders", activeProfileId]
      });
    }, [queryClient, activeProfileId, route.params?.kindFilter, navigation])
  );

  const me = meQ.data;
  const hasShop = hasMerchantShop(me);
  const defaultShopId = me?.shops[0]?.id;
  const atFreeLimit =
    me?.subscriptionTier === "free" &&
    (me.activeProductCount ?? 0) >= (me.maxActiveProducts ?? 5);

  const openProduct = useCallback(
    (productId: string) => {
      navigation.navigate("MerchantMyProductDetail", { productId });
    },
    [navigation]
  );

  const openOffer = useCallback(
    (offerId: string) => {
      navigation.navigate("MillIngredientOfferDetail", { offerId });
    },
    [navigation]
  );

  const openCreate = useCallback(() => {
    navigation.navigate("MerchantProductForm", {
      shopId: defaultShopId,
      createKind: millOk && kindFilter === "ingredients" ? "ingredient" : "product"
    });
  }, [navigation, defaultShopId, millOk, kindFilter]);

  const toggleOfferPublic = useMutation({
    mutationFn: (offer: MillIngredientOfferDto) =>
      updateMillIngredientOffer(accessToken!, activeProfileId!, offer.id, {
        isPubliclyListed: !offer.isPubliclyListed
      }),
    onSuccess: () => void invalidate(),
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const deactivateOffer = useMutation({
    mutationFn: (offerId: string) =>
      deactivateMillIngredientOffer(accessToken!, activeProfileId!, offerId),
    onSuccess: () => void invalidate(),
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const renderOfferCard = useCallback(
    (item: MillIngredientOfferDto) => (
      <Pressable
        style={styles.offerCard}
        onPress={() => openOffer(item.id)}
        testID={`mill-offer-card-${item.id}`}
      >
        <FeedIngredientIcon
          imageUrl={item.feedIngredientImageUrl}
          iconKey={item.feedIngredientIconKey}
          category={item.feedIngredientCategory}
          canonicalName={item.feedIngredientName}
          size={44}
        />
        <View style={styles.offerBody}>
          <Text style={styles.offerName}>
            {item.feedIngredientName ?? item.feedIngredientId}
          </Text>
          <Text style={styles.offerMeta}>
            {Number(item.pricePerUnit).toLocaleString("fr-FR")} XOF ·{" "}
            {t("merchant.millIngredients.stockLabel", {
              qty: item.stockQuantity
            })}
          </Text>
          <Text style={styles.offerBadge}>
            {item.isPubliclyListed
              ? t("merchant.millIngredients.publicBadge")
              : t("merchant.millIngredients.privateBadge")}
          </Text>
          <View style={styles.offerActions}>
            <Pressable onPress={() => toggleOfferPublic.mutate(item)}>
              <Text style={styles.offerActionTx}>
                {item.isPubliclyListed
                  ? t("merchant.millIngredients.unlist")
                  : t("merchant.millIngredients.listPublic")}
              </Text>
            </Pressable>
            <Pressable onPress={() => deactivateOffer.mutate(item.id)}>
              <Text style={styles.offerActionDanger}>
                {t("merchant.millIngredients.deactivate")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    ),
    [openOffer, t, toggleOfferPublic, deactivateOffer]
  );

  const listHeader = useMemo(
    () => (
      <View>
        <MerchantProductsSalesSection
          orders={ordersQ.data}
          loading={ordersQ.isLoading}
        />
        <MerchantProductsRestockSection
          products={productsQ.data}
          orders={ordersQ.data}
          loading={productsQ.isLoading || ordersQ.isLoading}
          onProductPress={openProduct}
        />
        {millOk && kindFilter === "all" && filteredOffers.length > 0 ? (
          <View style={styles.offersInAll}>
            <Text style={styles.catalogTitle}>
              {t("merchant.millIngredients.sectionInAll")}
            </Text>
            <View style={styles.offersInAllList}>
              {filteredOffers.map((item) => (
                <View key={item.id}>{renderOfferCard(item)}</View>
              ))}
            </View>
          </View>
        ) : null}
        <Text style={styles.catalogTitle}>{t("merchant.products.catalogTitle")}</Text>
      </View>
    ),
    [
      ordersQ.data,
      ordersQ.isLoading,
      productsQ.data,
      productsQ.isLoading,
      openProduct,
      millOk,
      kindFilter,
      filteredOffers,
      renderOfferCard,
      t
    ]
  );

  const header = (
    <View style={styles.topBar}>
      <Text style={styles.title}>{t("merchant.products.title")}</Text>
      {hasShop ? (
        <Pressable
          style={styles.addBtn}
          onPress={openCreate}
          testID="merchant-products-add"
        >
          <Text style={styles.addBtnTx}>+</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.createShopBtn}
          onPress={() => navigation.navigate("MerchantShops")}
        >
          <Text style={styles.createShopBtnTx}>{t("merchant.onboarding.createShop")}</Text>
        </Pressable>
      )}
    </View>
  );

  const showInitialLoader = (meQ.isLoading && !me) || (productsQ.isLoading && !productsQ.data);

  return (
    <MerchantMobileShell customHeader={header} omitBottomTabBar>
      {showInitialLoader ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={merchantColors.primary} />
      ) : !hasShop ? (
        <View style={[styles.noShopWrap, { paddingBottom: bottomInset }]}>
          <Text style={styles.noShopTitle}>{t("merchant.dashboard.nudgeCreateShop")}</Text>
          <Pressable
            style={styles.createShopPrimary}
            onPress={() => navigation.navigate("MerchantShops")}
          >
            <Text style={styles.createShopPrimaryTx}>{t("merchant.onboarding.createShop")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {millOk ? (
            <View style={styles.filters} testID="mill-kind-filters">
              {(
                [
                  ["all", "kindFilterAll"],
                  ["ingredients", "kindFilterIngredients"],
                  ["other", "kindFilterOther"]
                ] as const
              ).map(([k, labelKey]) => (
                <Pressable
                  key={k}
                  style={[
                    styles.filterChip,
                    kindFilter === k && styles.filterChipOn
                  ]}
                  onPress={() => setKindFilter(k)}
                  testID={`mill-kind-filter-${k}`}
                >
                  <Text
                    style={[
                      styles.filterTx,
                      kindFilter === k && styles.filterTxOn
                    ]}
                  >
                    {t(`merchant.products.${labelKey}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipOn]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[styles.filterTx, filter === f && styles.filterTxOn]}
                >
                  {t(`merchant.products.filter.${f}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {millOk && kindFilter === "ingredients" ? (
            <FlatList
              // Remount distinct du grid 2 colonnes : RN interdit de changer numColumns à chaud.
              key="mill-ingredient-offers"
              testID="mill-ingredients-in-products"
              data={filteredOffers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                padding: H_PAD,
                paddingBottom: bottomInset + mobileSpacing.lg,
                gap: 10
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void Promise.all([
                      offersQ.refetch(),
                      productsQ.refetch(),
                      meQ.refetch()
                    ]).finally(() => setRefreshing(false));
                  }}
                  tintColor={merchantColors.primary}
                />
              }
              ListEmptyComponent={
                offersQ.isLoading ? (
                  <ActivityIndicator
                    style={{ marginTop: 24 }}
                    color={merchantColors.primary}
                  />
                ) : (
                  <Text style={styles.empty}>
                    {t("merchant.millIngredients.empty")}
                  </Text>
                )
              }
              renderItem={({ item }) => renderOfferCard(item)}
            />
          ) : (
            <FlatList
              key="merchant-products-grid"
              data={filtered}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.column}
              ListHeaderComponent={listHeader}
              contentContainerStyle={{
                padding: H_PAD,
                paddingBottom: bottomInset + mobileSpacing.lg
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void Promise.all([
                      productsQ.refetch(),
                      ordersQ.refetch(),
                      meQ.refetch(),
                      millOk ? offersQ.refetch() : Promise.resolve()
                    ]).finally(() => setRefreshing(false));
                  }}
                  tintColor={merchantColors.primary}
                />
              }
              ListEmptyComponent={
                millOk && kindFilter === "all" && filteredOffers.length > 0 ? (
                  <Text style={styles.emptyMuted}>
                    {t("merchant.products.kindFilterOther")} —{" "}
                    {t("merchant.dashboard.noProducts")}
                  </Text>
                ) : (
                  <Text style={styles.empty}>
                    {t("merchant.dashboard.noProducts")}
                  </Text>
                )
              }
              renderItem={({ item }) => (
                <MerchantProductGridCard
                  product={item}
                  width={cardWidth}
                  onPress={() => openProduct(item.id)}
                  onTogglePublish={() => togglePublish.mutate(item)}
                  publishBusy={togglePublish.isPending}
                  showSwap={
                    me?.subscriptionTier === "free" &&
                    item.status === "disabled"
                  }
                  onSwap={() => swapActive.mutate(item.id)}
                  onDelete={() => confirmDelete(item)}
                  atFreeLimit={atFreeLimit}
                />
              )}
            />
          )}
        </>
      )}
    </MerchantMobileShell>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    backgroundColor: merchantColors.canvas
  },
  title: { fontSize: mobileFontSize.xl, fontWeight: "800", color: merchantColors.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.xl,
    backgroundColor: merchantColors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  addBtnTx: { color: mobileColors.background, fontSize: mobileFontSize.xl, fontWeight: "700", marginTop: -2 },
  createShopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: merchantRadius.pill,
    backgroundColor: merchantColors.primary
  },
  createShopBtnTx: { color: mobileColors.background, fontWeight: "700", fontSize: mobileFontSize.sm },
  noShopWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl,
    gap: mobileSpacing.lg
  },
  noShopTitle: {
    textAlign: "center",
    color: merchantColors.textSecondary,
    fontSize: mobileFontSize.lg,
    lineHeight: 22
  },
  createShopPrimary: {
    backgroundColor: merchantColors.primary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: merchantRadius.pill
  },
  createShopPrimaryTx: { color: mobileColors.background, fontWeight: "800", fontSize: mobileFontSize.lg },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: merchantColors.canvas
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: merchantRadius.pill,
    borderWidth: 1,
    borderColor: merchantColors.border,
    backgroundColor: merchantColors.cardBg
  },
  filterChipOn: {
    backgroundColor: merchantColors.primaryLight,
    borderColor: merchantColors.primary
  },
  filterTx: { fontSize: mobileFontSize.sm, fontWeight: "600", color: merchantColors.textSecondary },
  filterTxOn: { color: merchantColors.primary },
  column: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP
  },
  catalogTitle: {
    fontSize: mobileFontSize.sm,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: merchantColors.textSecondary,
    marginBottom: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  empty: { textAlign: "center", color: merchantColors.textSecondary, marginTop: 24 },
  emptyMuted: {
    textAlign: "center",
    color: merchantColors.textSecondary,
    marginTop: 8,
    marginBottom: 16,
    fontSize: mobileFontSize.sm
  },
  offersInAll: {
    marginBottom: mobileSpacing.md
  },
  offersInAllList: {
    gap: 10,
    marginBottom: mobileSpacing.sm
  },
  offerCard: {
    flexDirection: "row",
    gap: 12,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: merchantColors.border,
    backgroundColor: merchantColors.cardBg
  },
  offerBody: { flex: 1, gap: 4 },
  offerName: {
    fontWeight: "800",
    fontSize: mobileFontSize.md,
    color: merchantColors.textPrimary
  },
  offerMeta: {
    fontSize: mobileFontSize.sm,
    color: merchantColors.textSecondary
  },
  offerBadge: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: merchantColors.primary
  },
  offerActions: { flexDirection: "row", gap: 16, marginTop: 6 },
  offerActionTx: { fontWeight: "700", color: merchantColors.primary },
  offerActionDanger: { fontWeight: "700", color: "#B91C1C" }
});
