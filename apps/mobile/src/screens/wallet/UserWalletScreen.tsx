import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text
} from "react-native";
import { profileScreenScrollContent } from "../../components/layout";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { WalletHistoryList } from "../../components/wallet/WalletHistoryList";
import { WalletScreenShell } from "../../components/wallet/WalletScreenShell";
import { ModuleFeatureGate } from "../../components/ModuleFeatureGate";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  fetchUserWallet,
  fetchUserWalletEntries
} from "../../lib/api";
import { buyerColors } from "../../theme/buyerTheme";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

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
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, authMe, activeProfileId } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const needsPhone = !authMe?.user?.phone;

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
    <ModuleFeatureGate feature="wallet">
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
          {needsPhone ? (
            <Pressable
              style={styles.phoneBanner}
              onPress={() => navigation.navigate("AddPhone")}
              accessibilityRole="button"
              accessibilityLabel={t("addPhone.walletBanner")}
            >
              <Text style={styles.phoneBannerText}>
                {t("addPhone.walletBanner")}
              </Text>
              <Text style={styles.phoneBannerChevron}>›</Text>
            </Pressable>
          ) : null}

          {accessToken ? (
            <WalletDashboardCard variant={walletVariant} hideDetailsLink />
          ) : null}

          <WalletHistoryList />
        </ScrollView>
      </WalletScreenShell>
    </ModuleFeatureGate>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: mobileSpacing.lg
  },
  phoneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.md
  },
  phoneBannerText: {
    ...mobileTypography.body,
    flex: 1,
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.md,
    fontWeight: "600"
  },
  phoneBannerChevron: {
    fontSize: mobileFontSize.xl,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
