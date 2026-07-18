import { useFocusEffect, useNavigation } from "@react-navigation/native";
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
import {
  deleteMerchantProduct,
  fetchMerchantMe,
  fetchMerchantProducts,
  fetchMerchantSellerOrders,
  publishMerchantProduct,
  swapMerchantProductActive,
  unpublishMerchantProduct,
  type MerchantProductDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { hasMerchantShop } from "../../lib/merchantShop";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type StatusFilter =
  | "all"
  | "published"
  | "disabled"
  | "draft"
  | "moderated_removed"
  | "resubmission_review";

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
  const bottomInset = useBottomInset();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId } = useSession();
  const [filter, setFilter] = useState<StatusFilter>("all");
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

  const productsQ = useQuery({
    queryKey: ["merchant-products", activeProfileId],
    queryFn: () => fetchMerchantProducts(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const ordersQ = useQuery({
    queryKey: ["merchant-seller-orders", activeProfileId],
    queryFn: () => fetchMerchantSellerOrders(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const filtered = useMemo(() => {
    const items = productsQ.data ?? [];
    if (filter === "all") return items;
    return items.filter((p) => p.status === filter);
  }, [productsQ.data, filter]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["merchant-products", activeProfileId] });
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
      if (!activeProfileId) return;
      void queryClient.invalidateQueries({
        queryKey: ["merchant-me", activeProfileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["merchant-products", activeProfileId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["merchant-seller-orders", activeProfileId]
      });
    }, [queryClient, activeProfileId])
  );

  const me = meQ.data;
  const hasShop = hasMerchantShop(me);
  const defaultShopId = me?.shops[0]?.id;
  const atFreeLimit =
    me?.subscriptionTier === "free" &&
    (me.activeProductCount ?? 0) >= (me.maxActiveProducts ?? 5);

  const openProduct = useCallback(
    (productId: string) => {
      navigation.navigate("MerchantProductForm", { productId });
    },
    [navigation]
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
        <Text style={styles.catalogTitle}>{t("merchant.products.catalogTitle")}</Text>
      </View>
    ),
    [
      ordersQ.data,
      ordersQ.isLoading,
      productsQ.data,
      productsQ.isLoading,
      openProduct,
      t
    ]
  );

  const header = (
    <View style={styles.topBar}>
      <Text style={styles.title}>{t("merchant.products.title")}</Text>
      {hasShop ? (
        <Pressable
          style={styles.addBtn}
          onPress={() =>
            navigation.navigate("MerchantProductForm", {
              shopId: defaultShopId
            })
          }
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
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipOn]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterTx, filter === f && styles.filterTxOn]}>
                  {t(`merchant.products.filter.${f}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <FlatList
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
                    meQ.refetch()
                  ]).finally(() => setRefreshing(false));
                }}
                tintColor={merchantColors.primary}
              />
            }
            ListEmptyComponent={
              <Text style={styles.empty}>{t("merchant.dashboard.noProducts")}</Text>
            }
            renderItem={({ item }) => (
              <MerchantProductGridCard
                product={item}
                width={cardWidth}
                onPress={() => openProduct(item.id)}
                onTogglePublish={() => togglePublish.mutate(item)}
                publishBusy={togglePublish.isPending}
                showSwap={me?.subscriptionTier === "free" && item.status === "disabled"}
                onSwap={() => swapActive.mutate(item.id)}
                onDelete={() => confirmDelete(item)}
                atFreeLimit={atFreeLimit}
              />
            )}
          />
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
  title: { fontSize: 22, fontWeight: "800", color: merchantColors.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: merchantColors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  addBtnTx: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: -2 },
  createShopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: merchantRadius.pill,
    backgroundColor: merchantColors.primary
  },
  createShopBtnTx: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
    fontSize: 16,
    lineHeight: 22
  },
  createShopPrimary: {
    backgroundColor: merchantColors.primary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: merchantRadius.pill
  },
  createShopPrimaryTx: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
  filterTx: { fontSize: 12, fontWeight: "600", color: merchantColors.textSecondary },
  filterTxOn: { color: merchantColors.primary },
  column: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP
  },
  catalogTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: merchantColors.textSecondary,
    marginBottom: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  empty: { textAlign: "center", color: merchantColors.textSecondary, marginTop: 24 }
});
