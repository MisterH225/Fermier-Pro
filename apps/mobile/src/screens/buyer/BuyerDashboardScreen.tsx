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
  Text,
  View
} from "react-native";
import { PendingInvitationsBanner } from "../../components/collaboration/PendingInvitationsBanner";
import { PigPriceIndex } from "../../components/market/PigPriceIndex";
import { BuyerActiveProposalsSection } from "../../components/buyer/BuyerActiveProposalsSection";
import { BuyerPendingMarketplaceBanner } from "../../components/buyer/BuyerPendingMarketplaceBanner";
import { BuyerWelcomeHeader } from "../../components/buyer/BuyerWelcomeHeader";
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
import { fetchBuyerDashboard } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
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
          <SupportHeaderButton
            iconColor={buyerColors.primary}
            style={styles.heroIconBtn}
          />
          <NotificationsHeaderButton
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

        {/* 1) Action requise */}
        <BuyerActiveProposalsSection />

        {/* 2) Portefeuille */}
        <WalletDashboardCard variant="buyer" />

        {/* 3) Index prix porc */}
        <PigPriceIndex />

        {/* 4) Duo KPI info (non cliquables) */}
        <ScreenSection title={t("buyer.dashboard.sectionStats")} plain>
          <View style={styles.duo}>
            <View style={[styles.infoCard, buyerShadow.card]}>
              <Text style={styles.infoValue}>
                {kpis?.purchasesCount ?? 0}
              </Text>
              <Text style={styles.infoLabel}>
                {t("buyer.kpi.purchasesInProgress")}
              </Text>
            </View>
            <View style={[styles.infoCard, buyerShadow.card]}>
              <Text style={styles.infoValue}>
                {kpis?.pendingProposals ?? 0}
              </Text>
              <Text style={styles.infoLabel}>
                {t("buyer.kpi.proposalsSent")}
              </Text>
            </View>
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
    borderRadius: buyerRadius.pill,
    backgroundColor: buyerColors.cardBg
  },
  heroIconBtnPressed: {
    opacity: 0.85
  },
  duo: {
    flexDirection: "row",
    gap: 10
  },
  infoCard: {
    flex: 1,
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  infoValue: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: buyerColors.primary
  },
  infoLabel: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: 2
  }
});
