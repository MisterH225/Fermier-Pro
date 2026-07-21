import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchMerchantMe } from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { hasMerchantShop } from "../../lib/merchantShop";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing, mobileColors, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function MerchantShopsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  useFocusEffect(
    useCallback(() => {
      if (!activeProfileId) return;
      void queryClient.invalidateQueries({
        queryKey: ["merchant-me", activeProfileId]
      });
    }, [queryClient, activeProfileId])
  );

  const me = meQ.data;
  const shops = me?.shops ?? [];
  const hasShop = hasMerchantShop(me);
  const canCreateShop = (me?.shopCount ?? 0) < (me?.maxShops ?? 1);
  const showInitialLoader = meQ.isLoading && !me;
  const showError = meQ.isError && !me;

  const header = (
    <View style={styles.topBar}>
      <Text style={styles.title}>{t("merchant.shops.title")}</Text>
      {canCreateShop ? (
        <Pressable
          style={styles.addBtn}
          onPress={() => navigation.navigate("MerchantShop")}
          testID="merchant-shops-create"
        >
          <Ionicons name="add" size={24} color={mobileColors.background} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <MerchantMobileShell customHeader={header} omitBottomTabBar>
      <View style={styles.flex} testID="merchant-shops-screen">
        {showInitialLoader ? (
          <ActivityIndicator
            style={{ marginTop: 40 }}
            color={merchantColors.primary}
          />
        ) : showError ? (
          <View style={[styles.emptyWrap, { paddingBottom: bottomInset }]}>
            <Text style={styles.emptyTitle}>
              {formatApiError(meQ.error)}
            </Text>
            <Pressable
              style={styles.createPrimary}
              onPress={() => void meQ.refetch()}
              testID="merchant-shops-retry"
            >
              <Text style={styles.createPrimaryTx}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : !hasShop ? (
          <View style={[styles.emptyWrap, { paddingBottom: bottomInset }]}>
            <Text style={styles.emptyTitle}>
              {t("merchant.dashboard.nudgeCreateShop")}
            </Text>
            <Pressable
              style={styles.createPrimary}
              onPress={() => navigation.navigate("MerchantShop")}
              testID="merchant-shops-empty-create"
            >
              <Text style={styles.createPrimaryTx}>
                {t("merchant.onboarding.createShop")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={shops}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              padding: mobileSpacing.md,
              paddingBottom: bottomInset,
              gap: mobileSpacing.sm
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void meQ.refetch().finally(() => setRefreshing(false));
                }}
                tintColor={merchantColors.primary}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.card, merchantShadow.card]}
                onPress={() =>
                  navigation.navigate("MerchantShopDetail", { shopId: item.id })
                }
                testID={`merchant-shop-card-${item.id}`}
              >
                <View style={styles.cardHead}>
                  <View style={styles.shopIcon}>
                    <Ionicons
                      name="storefront"
                      size={22}
                      color={merchantColors.primary}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    {item.locationLabel ? (
                      <Text style={styles.cardMeta}>{item.locationLabel}</Text>
                    ) : null}
                    <Text style={styles.cardMeta}>
                      {t("merchant.shops.productCount", {
                        count: item.productCount
                      })}
                      {item.activeProductCount > 0
                        ? ` · ${t("merchant.shops.activeCount", {
                            count: item.activeProductCount
                          })}`
                        : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={merchantColors.textMuted}
                  />
                </View>
                <Pressable
                  style={styles.addProductBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    navigation.navigate("MerchantProductForm", {
                      shopId: item.id
                    });
                  }}
                  testID={`merchant-shop-add-product-${item.id}`}
                >
                  <Text style={styles.addProductTx}>
                    {t("merchant.shops.addProduct")}
                  </Text>
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </View>
    </MerchantMobileShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl,
    gap: mobileSpacing.lg
  },
  emptyTitle: {
    textAlign: "center",
    color: merchantColors.textSecondary,
    fontSize: mobileFontSize.lg,
    lineHeight: 22
  },
  createPrimary: {
    backgroundColor: merchantColors.primary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: merchantRadius.pill
  },
  createPrimaryTx: { color: mobileColors.background, fontWeight: "800", fontSize: mobileFontSize.lg },
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border,
    gap: mobileSpacing.sm
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: mobileSpacing.sm },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.xl,
    backgroundColor: merchantColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 2 },
  cardName: { fontWeight: "800", fontSize: mobileFontSize.lg, color: merchantColors.textPrimary },
  cardMeta: { color: merchantColors.textSecondary, fontSize: mobileFontSize.sm },
  addProductBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: merchantRadius.pill,
    borderWidth: 1,
    borderColor: merchantColors.primary
  },
  addProductTx: { color: merchantColors.primary, fontWeight: "700", fontSize: mobileFontSize.sm }
});
