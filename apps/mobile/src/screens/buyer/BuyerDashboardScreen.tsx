import { Ionicons } from "@expo/vector-icons";
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
  View
} from "react-native";
import { PendingInvitationsBanner } from "../../components/collaboration/PendingInvitationsBanner";
import { PigPriceIndex } from "../../components/market/PigPriceIndex";
import { BuyerActiveProposalsSection } from "../../components/buyer/BuyerActiveProposalsSection";
import { BuyerPendingMarketplaceBanner } from "../../components/buyer/BuyerPendingMarketplaceBanner";
import { BuyerWelcomeHeader } from "../../components/buyer/BuyerWelcomeHeader";
import { KpiTile, buyerPalette } from "../../components/common";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { NotificationsHeaderButton } from "../../components/notifications/NotificationsHeaderButton";
import { ShopOrdersTrackingCard } from "../../components/notifications/ShopOrdersTrackingCard";
import { SupportHeaderButton } from "../../components/support/SupportHeaderButton";
import {
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { openBuyerOffersHub } from "../../lib/buyerMarketplacePending";
import { fetchBuyerDashboard } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

export function BuyerDashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const dashQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
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
          onPressAvatar={() => navigation.navigate("BuyerAccount")}
        />
        <View style={styles.heroActions}>
          <NotificationsHeaderButton
            iconColor={buyerColors.primary}
            style={styles.heroIconBtn}
          />
          <SupportHeaderButton
            iconColor={buyerColors.primary}
            style={styles.heroIconBtn}
          />
          <Pressable
            onPress={() => navigation.navigate("BuyerAccount")}
            style={({ pressed }) => [
              styles.heroIconBtn,
              pressed && styles.heroIconBtnPressed
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("buyer.account.title")}
            testID="buyer-settings-button"
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={buyerColors.primary}
            />
          </Pressable>
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

        <BuyerActiveProposalsSection />

        <PigPriceIndex />

        <ScreenSection title={t("buyer.dashboard.sectionStats")} plain>
          <View style={styles.kpiGrid}>
            <KpiTile
              label={t("buyer.kpi.purchases")}
              value={kpis?.purchasesCount ?? 0}
              bg={buyerColors.kpiGreen}
              accent={buyerColors.success}
              palette={buyerPalette}
              onPress={() =>
                navigation.navigate("BuyerHistory", {
                  initialSegment: "active"
                })
              }
            />
            <KpiTile
              label={t("buyer.kpi.pending")}
              value={kpis?.pendingProposals ?? 0}
              bg={buyerColors.kpiPurple}
              accent={buyerColors.primary}
              palette={buyerPalette}
              onPress={() => openBuyerOffersHub(navigation)}
            />
          </View>
        </ScreenSection>
      </ScrollView>
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
  heroIconBtnPressed: {
    opacity: 0.85
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm }
});
