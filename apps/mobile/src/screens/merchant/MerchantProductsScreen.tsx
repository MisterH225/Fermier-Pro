import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  fetchMerchantMe,
  fetchMerchantProducts,
  publishMerchantProduct,
  swapMerchantProductActive,
  unpublishMerchantProduct,
  type MerchantProductDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { hasMerchantShop } from "../../lib/merchantShop";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type StatusFilter = "all" | "published" | "disabled" | "draft" | "moderated_removed";

const FILTERS: StatusFilter[] = ["all", "published", "disabled", "draft", "moderated_removed"];

function statusLabel(t: (k: string) => string, status: string) {
  const key = `merchant.products.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function MerchantProductsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId } = useSession();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

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

  const filtered = useMemo(() => {
    const items = productsQ.data ?? [];
    if (filter === "all") return items;
    return items.filter((p) => p.status === filter);
  }, [productsQ.data, filter]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["merchant-products", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-me", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-dashboard", activeProfileId] });
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

  useFocusEffect(
    useCallback(() => {
      void meQ.refetch();
      void productsQ.refetch();
    }, [meQ, productsQ])
  );

  const me = meQ.data;
  const hasShop = hasMerchantShop(me);
  const defaultShopId = me?.shops[0]?.id;
  const atFreeLimit =
    me?.subscriptionTier === "free" &&
    (me.activeProductCount ?? 0) >= (me.maxActiveProducts ?? 5);

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

  return (
    <MerchantMobileShell customHeader={header} omitBottomTabBar>
      {!hasShop ? (
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

      {productsQ.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={merchantColors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: mobileSpacing.md, paddingBottom: bottomInset, gap: mobileSpacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void productsQ.refetch().finally(() => setRefreshing(false));
              }}
              tintColor={merchantColors.primary}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>{t("merchant.dashboard.noProducts")}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, merchantShadow.card]}>
              <View style={styles.cardHead}>
                <Text style={styles.cardName}>{item.name}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusTx}>{statusLabel(t, item.status)}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {item.price.toLocaleString("fr-FR")} {item.currency} · {item.stock} {t("merchant.dashboard.stock")}
              </Text>
              <Text style={styles.cardMeta}>{item.categoryName ?? ""}</Text>
              <View style={styles.actions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() =>
                    navigation.navigate("MerchantProductForm", { productId: item.id })
                  }
                >
                  <Text style={styles.actionTx}>{t("merchant.products.edit")}</Text>
                </Pressable>
                {item.status !== "moderated_removed" ? (
                  <Pressable
                    style={styles.actionBtn}
                    disabled={togglePublish.isPending}
                    onPress={() => togglePublish.mutate(item)}
                  >
                    <Text style={styles.actionTx}>
                      {item.status === "published"
                        ? t("merchant.products.unpublish")
                        : t("merchant.products.publish")}
                    </Text>
                  </Pressable>
                ) : null}
                {me?.subscriptionTier === "free" && item.status === "disabled" ? (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => swapActive.mutate(item.id)}
                  >
                    <Text style={styles.actionTx}>{t("merchant.products.swap")}</Text>
                  </Pressable>
                ) : null}
                {atFreeLimit && item.status === "draft" ? (
                  <Text style={styles.hint}>{t("merchant.products.freeLimitHint")}</Text>
                ) : null}
              </View>
            </View>
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
  filterChipOn: { backgroundColor: merchantColors.primaryLight, borderColor: merchantColors.primary },
  filterTx: { fontSize: 12, fontWeight: "600", color: merchantColors.textSecondary },
  filterTxOn: { color: merchantColors.primary },
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardName: { fontWeight: "800", fontSize: 16, flex: 1 },
  statusPill: {
    backgroundColor: merchantColors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: merchantRadius.pill
  },
  statusTx: { fontSize: 11, fontWeight: "700", color: merchantColors.primary },
  cardMeta: { color: merchantColors.textSecondary, marginTop: 4, fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: mobileSpacing.sm },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: merchantRadius.button,
    borderWidth: 1,
    borderColor: merchantColors.primary
  },
  actionTx: { color: merchantColors.primary, fontWeight: "700", fontSize: 13 },
  hint: { fontSize: 12, color: merchantColors.warning, flexBasis: "100%" },
  empty: { textAlign: "center", color: merchantColors.textSecondary, marginTop: 40 }
});
