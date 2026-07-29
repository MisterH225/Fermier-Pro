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
import { BuyerCreditDuesSection } from "../../components/buyer/BuyerCreditDuesSection";
import { BuyerPendingMarketplaceBanner } from "../../components/buyer/BuyerPendingMarketplaceBanner";
import { BuyerProposalsBreakdownCard } from "../../components/buyer/BuyerProposalsBreakdownCard";
import { BuyerPurchasesPeriodCard } from "../../components/buyer/BuyerPurchasesPeriodCard";
import { BuyerWelcomeHeader } from "../../components/buyer/BuyerWelcomeHeader";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { NotificationsHeaderButton } from "../../components/notifications/NotificationsHeaderButton";
import { ShopOrdersTrackingCard } from "../../components/notifications/ShopOrdersTrackingCard";
import { SupportHeaderButton } from "../../components/support/SupportHeaderButton";
import { profileScreenScrollContent } from "../../components/layout";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchBuyerDashboard } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

/**
 * Dashboard acheteur — structure calquée sur le producteur :
 * bannières → propositions → wallet → achats (période) → crédits → raccourcis.
 */
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
      {accessToken ? <WalletDashboardCard variant="buyer" /> : null}
    </View>
  );

  return (
    <BuyerMobileShell customHeader={dashboardHeader} omitBottomTabBar>
      <ScrollView
        testID="buyer-dashboard-screen"
        contentContainerStyle={[
          profileScreenScrollContent,
          styles.wrap,
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

        <BuyerProposalsBreakdownCard
          proposals={dashQ.data?.proposals}
          isLoading={dashQ.isPending}
        />

        <BuyerPurchasesPeriodCard
          purchases={dashQ.data?.purchases}
          isLoading={dashQ.isPending}
        />

        <BuyerCreditDuesSection creditDues={dashQ.data?.creditDues} />

        <PigPriceIndex />
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
  wrap: {
    gap: mobileSpacing.lg
  }
});
