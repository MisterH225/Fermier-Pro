import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ScreenSection, profileScreenScrollContent } from "../../components/layout";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { MerchantOnboardingNudgeBanner } from "../../components/merchant/MerchantOnboardingNudgeBanner";
import { MerchantProfileModal } from "../../components/merchant/MerchantProfileModal";
import { MerchantSubscriptionBadge } from "../../components/merchant/MerchantSubscriptionBadge";
import { MerchantWelcomeHeader } from "../../components/merchant/MerchantWelcomeHeader";
import { NotificationsHeaderButton } from "../../components/notifications/NotificationsHeaderButton";
import { SupportHeaderButton } from "../../components/support/SupportHeaderButton";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchMerchantDashboard, fetchMerchantMe } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function MerchantDashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const dashQ = useQuery({
    queryKey: ["merchant-dashboard", activeProfileId],
    queryFn: () => fetchMerchantDashboard(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await Promise.all([meQ.refetch(), dashQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, meQ, dashQ]);

  useFocusEffect(
    useCallback(() => {
      void meQ.refetch();
      void dashQ.refetch();
    }, [meQ, dashQ])
  );

  const me = meQ.data;
  const dash = dashQ.data;
  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("merchant.dashboard.defaultName");

  const header: ReactNode = (
    <View style={styles.heroBar}>
      <View style={styles.heroHeaderRow}>
        <MerchantWelcomeHeader
          welcomeLabel={t("merchant.dashboard.welcomeLine")}
          displayName={displayName}
          avatarUrl={resolveActiveProfileAvatarUrl(authMe, activeProfileId)}
          onPressAvatar={() => setProfileOpen(true)}
        />
        <View style={styles.heroActions}>
          <NotificationsHeaderButton iconColor={merchantColors.primary} style={styles.heroIconBtn} />
          <SupportHeaderButton iconColor={merchantColors.primary} style={styles.heroIconBtn} />
        </View>
      </View>
      <WalletDashboardCard variant="producer" />
    </View>
  );

  return (
    <MerchantMobileShell customHeader={header} omitBottomTabBar>
      <ScrollView
        testID="merchant-dashboard-scroll"
        contentContainerStyle={[profileScreenScrollContent, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={merchantColors.primary}
          />
        }
      >
        {me?.subscriptionTier || me?.pendingSubscription ? (
          <MerchantSubscriptionBadge
            tier={me.subscriptionTier}
            status={me.subscriptionStatus ?? null}
            hasPendingSubscription={Boolean(me.pendingSubscription)}
          />
        ) : null}

        {me?.needsShopNudge || (me && me.shopCount === 0) ? (
          <MerchantOnboardingNudgeBanner
            variant="shop"
            onPress={() => navigation.navigate("MerchantShops")}
          />
        ) : null}
        {me?.needsProductNudge ? (
          <MerchantOnboardingNudgeBanner
            variant="product"
            onPress={() =>
              navigation.navigate("MerchantProductForm", {
                shopId: me?.shops[0]?.id
              })
            }
          />
        ) : null}

        <ScreenSection title={t("merchant.dashboard.sectionKpis")} plain>
          <View style={styles.kpiGrid}>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: merchantColors.primaryLight }]}
              onPress={() => navigation.navigate("MerchantOrders", { filter: "paid" })}
            >
              <Text style={[styles.kpiValue, { color: merchantColors.primary }]}>
                {(dash?.kpis.monthRevenueXof ?? 0).toLocaleString("fr-FR")}
              </Text>
              <Text style={styles.kpiLabel}>{t("merchant.kpi.revenue")}</Text>
            </Pressable>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: "#FFF3E0" }]}
              onPress={() => navigation.navigate("MerchantOrders", { filter: "payment_pending" })}
            >
              <Text style={[styles.kpiValue, { color: merchantColors.warning }]}>
                {dash?.kpis.pendingOrders ?? 0}
              </Text>
              <Text style={styles.kpiLabel}>{t("merchant.kpi.pendingOrders")}</Text>
            </Pressable>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: "#E8F5E9" }]}
              onPress={() => navigation.navigate("MerchantProducts")}
            >
              <Text style={[styles.kpiValue, { color: merchantColors.success }]}>
                {dash?.kpis.productViews ?? 0}
              </Text>
              <Text style={styles.kpiLabel}>{t("merchant.kpi.views")}</Text>
            </Pressable>
          </View>
        </ScreenSection>

        {(dash?.lowStockProducts.length ?? 0) > 0 ? (
          <ScreenSection title={t("merchant.dashboard.lowStockTitle")} plain>
            <View style={[styles.alertCard, merchantShadow.card]}>
              {dash!.lowStockProducts.map((p) => (
                <Text key={p.id} style={styles.alertLine}>
                  {t("merchant.dashboard.lowStockLine", {
                    name: p.name,
                    stock: p.stock,
                    shop: p.shopName
                  })}
                </Text>
              ))}
            </View>
          </ScreenSection>
        ) : null}

        {(dash?.moderationEvents.length ?? 0) > 0 ? (
          <ScreenSection title={t("merchant.dashboard.moderationTitle")} plain>
            <View style={[styles.moderationCard, merchantShadow.card]}>
              {dash!.moderationEvents.map((e) => (
                <View key={e.id} style={styles.moderationRow}>
                  <Text style={styles.moderationProduct}>{e.productName}</Text>
                  <Text style={styles.moderationReason}>{e.reason}</Text>
                </View>
              ))}
            </View>
          </ScreenSection>
        ) : null}
      </ScrollView>

      <MerchantProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </MerchantMobileShell>
  );
}

const styles = StyleSheet.create({
  heroBar: {
    flexDirection: "column",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    backgroundColor: merchantColors.canvas
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  heroActions: { flexDirection: "row", alignItems: "center", gap: mobileSpacing.xs },
  heroIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: merchantColors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: merchantColors.border
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  kpiCard: {
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 100,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  kpiValue: { fontSize: 22, fontWeight: "800" },
  kpiLabel: { ...mobileTypography.meta, textAlign: "center", marginTop: 4 },
  alertCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: "#F59E0B",
    gap: 6
  },
  alertLine: { color: "#92400E", fontWeight: "600" },
  moderationCard: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border,
    gap: mobileSpacing.sm
  },
  moderationRow: { gap: 2 },
  moderationProduct: { fontWeight: "700" },
  moderationReason: { color: merchantColors.textSecondary, fontSize: 13 }
});
