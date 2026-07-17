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
import { PendingInvitationsBanner } from "../../components/collaboration/PendingInvitationsBanner";
import { PigPriceIndex } from "../../components/market/PigPriceIndex";
import { BuyerActiveProposalsSection } from "../../components/buyer/BuyerActiveProposalsSection";
import { BuyerPendingMarketplaceBanner } from "../../components/buyer/BuyerPendingMarketplaceBanner";
import { BuyerProfileModal } from "../../components/buyer/BuyerProfileModal";
import { BuyerWelcomeHeader } from "../../components/buyer/BuyerWelcomeHeader";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { NotificationsHeaderButton } from "../../components/notifications/NotificationsHeaderButton";
import { ShopOrdersTrackingCard } from "../../components/notifications/ShopOrdersTrackingCard";
import { SupportHeaderButton } from "../../components/support/SupportHeaderButton";
import {
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { MeteoProfilCard } from "../../components/dashboard/MeteoProfilCard";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { openBuyerOffersHub } from "../../lib/buyerMarketplacePending";
import { fetchBuyerDashboard, fetchMyCreditScore } from "../../lib/api";
import { creditScoreToNumeric } from "../../constants/meteoProfil";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

export function BuyerDashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dashQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const creditScoreQ = useQuery({
    queryKey: ["myCreditScore", activeProfileId],
    queryFn: () => fetchMyCreditScore(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await dashQ.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, dashQ]);

  useFocusEffect(
    useCallback(() => {
      void refreshAuthMe();
      void dashQ.refetch();
    }, [refreshAuthMe, dashQ])
  );

  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("buyer.dashboard.defaultName");
  const kpis = dashQ.data?.kpis;

  const dashboardHeader: ReactNode = (
    <View style={styles.heroBar}>
      <View style={styles.heroHeaderRow}>
        <BuyerWelcomeHeader
          welcomeLabel={t("buyer.dashboard.welcomeLine")}
          displayName={displayName}
          avatarUrl={resolveActiveProfileAvatarUrl(authMe, activeProfileId)}
          onPressAvatar={() => setProfileOpen(true)}
        />
        <View style={styles.heroActions}>
          <NotificationsHeaderButton iconColor={buyerColors.primary} style={styles.heroIconBtn} />
          <SupportHeaderButton
            iconColor={buyerColors.primary}
            style={styles.heroIconBtn}
          />
        </View>
      </View>
      <WalletDashboardCard variant="buyer" />
    </View>
  );

  return (
    <BuyerMobileShell customHeader={dashboardHeader} omitBottomTabBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomInset }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={buyerColors.primary}
          />
        }
      >
        <PendingInvitationsBanner />
        <BuyerPendingMarketplaceBanner />
        <ShopOrdersTrackingCard
          accentColor={buyerColors.primary}
          backgroundColor={buyerColors.primaryLight}
        />

        <MeteoProfilCard
          score={creditScoreToNumeric(creditScoreQ.data?.score)}
          onPress={() => navigation.navigate("CreditDashboard")}
        />

        <BuyerActiveProposalsSection />

        <PigPriceIndex />

        <ScreenSection title={t("buyer.dashboard.sectionStats")} plain>
          <View style={styles.kpiGrid}>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: buyerColors.primaryLight }]}
              onPress={() => openBuyerOffersHub(navigation)}
            >
              <Text style={styles.kpiValue}>{kpis?.pendingProposals ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("buyer.kpi.pending")}</Text>
            </Pressable>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: "#E8F5E9" }]}
              onPress={() =>
                navigation.navigate("BuyerHistory", {
                  initialSegment: "active"
                })
              }
            >
              <Text style={[styles.kpiValue, { color: buyerColors.success }]}>
                {kpis?.purchasesCount ?? 0}
              </Text>
              <Text style={styles.kpiLabel}>{t("buyer.kpi.purchases")}</Text>
            </Pressable>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: "#FCE4EC" }]}
              onPress={() => navigation.navigate("BuyerFavorites")}
            >
              <Text style={styles.kpiValue}>{kpis?.favoritesCount ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("buyer.kpi.favorites")}</Text>
            </Pressable>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: "#FFF3E0" }]}
              onPress={() => navigation.navigate("BuyerAlerts")}
            >
              <Text style={styles.kpiValue}>{kpis?.activeAlerts ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("buyer.kpi.alerts")}</Text>
            </Pressable>
          </View>
        </ScreenSection>
      </ScrollView>

      <BuyerProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  heroBar: {
    flexDirection: "column",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    backgroundColor: buyerColors.canvas
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  heroIconBtn: {
    padding: mobileSpacing.sm,
    borderRadius: buyerRadius.pill
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  kpiCard: {
    width: "47%",
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.md
  },
  kpiValue: { fontSize: 22, fontWeight: "700", color: buyerColors.primary },
  kpiLabel: { ...mobileTypography.meta, color: buyerColors.textSecondary, marginTop: 4 }
});
