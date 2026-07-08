import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchMerchantMe, fetchMerchantProducts } from "../../lib/api";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

function statusLabel(t: (k: string) => string, status: string) {
  const key = `merchant.products.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function MerchantShopDetailScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MerchantShopDetail">>();
  const shopId = route.params.shopId;
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();
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

  useFocusEffect(
    useCallback(() => {
      void meQ.refetch();
      void productsQ.refetch();
    }, [meQ, productsQ])
  );

  const shop = useMemo(
    () => meQ.data?.shops.find((s) => s.id === shopId) ?? null,
    [meQ.data?.shops, shopId]
  );

  const shopProducts = useMemo(
    () => (productsQ.data ?? []).filter((p) => p.shopId === shopId),
    [productsQ.data, shopId]
  );

  if (meQ.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 40 }} color={merchantColors.primary} />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.emptyWrap, { paddingBottom: bottomInset }]}>
          <Text style={styles.emptyTitle}>{t("merchant.shops.notFound")}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnTx}>{t("common.close")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.shopName}>{shop.name}</Text>
        {shop.description ? (
          <Text style={styles.shopDesc}>{shop.description}</Text>
        ) : null}
        {shop.locationLabel ? (
          <Text style={styles.shopMeta}>{shop.locationLabel}</Text>
        ) : null}
        <Text style={styles.shopMeta}>
          {t("merchant.shops.productCount", { count: shop.productCount })}
        </Text>
      </View>

      <FlatList
        data={shopProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: mobileSpacing.md,
          paddingBottom: bottomInset + 72,
          gap: mobileSpacing.sm
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void Promise.all([meQ.refetch(), productsQ.refetch()]).finally(() =>
                setRefreshing(false)
              );
            }}
            tintColor={merchantColors.primary}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyList}>{t("merchant.shopDetail.noProducts")}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, merchantShadow.card]}
            onPress={() =>
              navigation.navigate("MerchantProductForm", {
                productId: item.id,
                shopId
              })
            }
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardName}>{item.name}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusTx}>{statusLabel(t, item.status)}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {item.price.toLocaleString("fr-FR")} {item.currency} · {item.stock}{" "}
              {t("merchant.dashboard.stock")}
            </Text>
          </Pressable>
        )}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, mobileSpacing.md) }]}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => navigation.navigate("MerchantProductForm", { shopId })}
          testID="merchant-shop-detail-add-product"
        >
          <Text style={styles.primaryBtnTx}>{t("merchant.shops.addProduct")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: merchantColors.canvas },
  header: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    paddingBottom: mobileSpacing.sm,
    gap: 4
  },
  shopName: { fontSize: 22, fontWeight: "800", color: merchantColors.textPrimary },
  shopDesc: { color: merchantColors.textSecondary, fontSize: 14, lineHeight: 20 },
  shopMeta: { color: merchantColors.textMuted, fontSize: 13 },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl,
    gap: mobileSpacing.lg
  },
  emptyTitle: { textAlign: "center", color: merchantColors.textSecondary, fontSize: 16 },
  emptyList: { textAlign: "center", color: merchantColors.textSecondary, marginTop: 40 },
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
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    backgroundColor: merchantColors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: merchantColors.border
  },
  primaryBtn: {
    backgroundColor: merchantColors.primary,
    paddingVertical: 14,
    borderRadius: merchantRadius.pill,
    alignItems: "center"
  },
  primaryBtnTx: { color: "#fff", fontWeight: "800", fontSize: 16 }
});
