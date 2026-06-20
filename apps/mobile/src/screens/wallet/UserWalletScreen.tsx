import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet
} from "react-native";
import { profileScreenScrollContent } from "../../components/layout";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { WalletHistoryList } from "../../components/wallet/WalletHistoryList";
import { WalletScreenShell } from "../../components/wallet/WalletScreenShell";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  fetchUserWallet,
  fetchUserWalletEntries
} from "../../lib/api";
import { buyerColors } from "../../theme/buyerTheme";
import { mobileSpacing } from "../../theme/mobileTheme";

function walletVariantForProfile(
  profileType: string | undefined
): "buyer" | "producer" | "vet" | "tech" {
  switch (profileType) {
    case "buyer":
      return "buyer";
    case "veterinarian":
      return "vet";
    case "technician":
      return "tech";
    default:
      return "producer";
  }
}

export function UserWalletScreen() {
  const bottomInset = useBottomInset();
  const { accessToken, authMe, activeProfileId } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const profileType = useMemo(
    () => authMe?.profiles.find((p) => p.id === activeProfileId)?.type,
    [authMe?.profiles, activeProfileId]
  );

  const walletQ = useQuery({
    queryKey: ["userWallet"],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken)
  });

  const entriesQ = useQuery({
    queryKey: ["userWalletEntries"],
    queryFn: () => fetchUserWalletEntries(accessToken!),
    enabled: Boolean(accessToken)
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([walletQ.refetch(), entriesQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [walletQ, entriesQ]);

  const walletVariant = walletVariantForProfile(profileType);

  return (
    <WalletScreenShell>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          styles.content,
          { paddingBottom: bottomInset + mobileSpacing.lg }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={buyerColors.primary}
          />
        }
      >
        {accessToken ? (
          <WalletDashboardCard variant={walletVariant} hideDetailsLink />
        ) : null}

        <WalletHistoryList />
      </ScrollView>
    </WalletScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: mobileSpacing.lg
  }
});
