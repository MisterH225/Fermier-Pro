import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { profileScreenScrollContent } from "../../components/layout";
import { TabSelector } from "../../components/tabs";
import { BuyerFinanceOverviewTab } from "../../components/buyer/BuyerFinanceOverviewTab";
import { BuyerFinanceCreditsTab } from "../../components/buyer/BuyerFinanceCreditsTab";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { WalletHistoryList } from "../../components/wallet/WalletHistoryList";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  fetchBuyerFinanceCredits,
  fetchBuyerFinanceOverview,
  type BuyerDashboardPeriodKey
} from "../../lib/api";
import { buyerColors } from "../../theme/buyerTheme";
import { mobileSpacing } from "../../theme/mobileTheme";

type FinanceTab = "overview" | "credits" | "wallet";

/**
 * Finance acheteur : aperçu des dépenses, crédits, portefeuille.
 * Remplace l'ancien ré-export de UserWalletScreen.
 */
export function BuyerFinanceScreen() {
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [period, setPeriod] = useState<BuyerDashboardPeriodKey>("month");
  const [refreshing, setRefreshing] = useState(false);

  const overviewQ = useQuery({
    queryKey: ["buyerFinanceOverview", activeProfileId, period],
    queryFn: () =>
      fetchBuyerFinanceOverview(accessToken!, activeProfileId, period),
    enabled: Boolean(accessToken)
  });

  const creditsQ = useQuery({
    queryKey: ["buyerFinanceCredits", activeProfileId],
    queryFn: () => fetchBuyerFinanceCredits(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([overviewQ.refetch(), creditsQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [overviewQ, creditsQ]);

  const tabs = useMemo(() => {
    const items = [
      {
        key: "overview",
        label: t("buyer.finance.tabOverview"),
        content: (
          <BuyerFinanceOverviewTab
            data={overviewQ.data}
            isLoading={overviewQ.isPending}
            period={period}
            onPeriodChange={setPeriod}
          />
        )
      },
      {
        key: "credits",
        label: t("buyer.finance.tabCredits"),
        content: (
          <BuyerFinanceCreditsTab
            data={creditsQ.data}
            isLoading={creditsQ.isPending}
          />
        )
      }
    ];
    if (clientFeatures.wallet) {
      items.push({
        key: "wallet",
        label: t("buyer.finance.tabWallet"),
        content: (
          <View style={styles.wallet} testID="buyer-finance-wallet">
            <WalletDashboardCard variant="buyer" hideDetailsLink />
            <View style={styles.walletHistory}>
              <WalletHistoryList accentColor={buyerColors.primary} />
            </View>
          </View>
        )
      });
    }
    return items;
  }, [
    t,
    overviewQ.data,
    overviewQ.isPending,
    creditsQ.data,
    creditsQ.isPending,
    period,
    clientFeatures.wallet
  ]);

  return (
    <BuyerMobileShell>
      <ScrollView
        testID="buyer-finance-screen"
        contentContainerStyle={[
          profileScreenScrollContent,
          styles.scroll,
          { paddingBottom: bottomInset + mobileSpacing.xl }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={buyerColors.primary}
          />
        }
      >
        <TabSelector
          tabs={tabs}
          activeTab={tab}
          onTabChange={(key) => setTab(key as FinanceTab)}
          testIDPrefix="buyer-finance-tab"
        />
      </ScrollView>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: mobileSpacing.md
  },
  wallet: {
    gap: mobileSpacing.md
  },
  walletHistory: {
    marginTop: mobileSpacing.sm
  }
});
