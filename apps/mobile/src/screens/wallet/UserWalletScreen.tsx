import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { profileScreenScrollContent } from "../../components/layout";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { WalletScreenShell } from "../../components/wallet/WalletScreenShell";
import { formatMarketMoney } from "../../components/marketplace/MarketplaceListingCard";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  fetchUserWallet,
  fetchUserWalletEntries,
  type BuyerWalletEntryDto
} from "../../lib/api";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

function entryLabel(
  kind: BuyerWalletEntryDto["kind"],
  t: (key: string) => string
): string {
  switch (kind) {
    case "credit_topup":
      return t("buyer.wallet.entry.topUp");
    case "debit_withdraw":
      return t("buyer.wallet.entry.withdraw");
    case "credit_transfer":
      return t("buyer.wallet.entry.transferIn");
    case "debit_transfer":
      return t("buyer.wallet.entry.transferOut");
    case "credit_escrow_release":
      return t("buyer.wallet.entry.escrowRelease");
    case "credit_refund":
      return t("buyer.wallet.entry.refund");
    case "credit_adjustment":
      return t("buyer.wallet.entry.creditAdjustment");
    case "debit_escrow_hold":
      return t("buyer.wallet.entry.purchase");
    case "debit_adjustment":
      return t("buyer.wallet.entry.debitAdjustment");
    default:
      return kind;
  }
}

function entryIcon(
  kind: BuyerWalletEntryDto["kind"]
): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "credit_topup":
    case "credit_transfer":
    case "credit_escrow_release":
    case "credit_refund":
    case "credit_adjustment":
      return "arrow-down-circle";
    case "debit_withdraw":
    case "debit_transfer":
    case "debit_escrow_hold":
    case "debit_adjustment":
      return "arrow-up-circle";
    default:
      return "swap-horizontal";
  }
}

function isCredit(kind: BuyerWalletEntryDto["kind"]): boolean {
  return (
    kind === "credit_topup" ||
    kind === "credit_transfer" ||
    kind === "credit_escrow_release" ||
    kind === "credit_refund" ||
    kind === "credit_adjustment"
  );
}

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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

  const entries = entriesQ.data?.entries ?? [];

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

        <Text style={styles.sectionTitle}>{t("buyer.finance.history")}</Text>
        <Text style={styles.sectionSub}>{t("buyer.finance.historyHint")}</Text>

        {entriesQ.isLoading ? (
          <ActivityIndicator color={buyerColors.primary} style={styles.loader} />
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="wallet-outline"
              size={40}
              color={buyerColors.textMuted}
            />
            <Text style={styles.emptyTitle}>{t("buyer.finance.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("buyer.finance.emptyBody")}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry) => {
              const credit = isCredit(entry.kind);
              const sign = credit ? "+" : "−";
              const amountLabel = `${sign}${formatMarketMoney(
                Math.round(entry.amount),
                entry.currency
              )}`;
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  disabled={!entry.transactionId}
                  onPress={() => {
                    if (entry.transactionId) {
                      navigation.navigate("MarketplaceTransaction", {
                        transactionId: entry.transactionId
                      });
                    }
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && entry.transactionId && { opacity: 0.9 }
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      credit ? styles.iconCredit : styles.iconDebit
                    ]}
                  >
                    <Ionicons
                      name={entryIcon(entry.kind)}
                      size={20}
                      color={credit ? buyerColors.success : buyerColors.primary}
                    />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {entryLabel(entry.kind, t)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {new Date(entry.createdAt).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </Text>
                    {entry.note ? (
                      <Text style={styles.rowNote} numberOfLines={2}>
                        {entry.note}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      credit ? styles.amountCredit : styles.amountDebit
                    ]}
                  >
                    {amountLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </WalletScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: mobileSpacing.lg
  },
  sectionTitle: {
    ...mobileTypography.sectionTitle,
    color: buyerColors.textPrimary
  },
  sectionSub: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: -mobileSpacing.sm
  },
  loader: { marginTop: mobileSpacing.lg },
  empty: {
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xl
  },
  emptyTitle: {
    ...mobileTypography.cardTitle,
    color: buyerColors.textPrimary
  },
  emptyBody: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    textAlign: "center"
  },
  list: { gap: mobileSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: buyerRadius.card,
    backgroundColor: buyerColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  iconCredit: { backgroundColor: "#E8F5E9" },
  iconDebit: { backgroundColor: buyerColors.primaryLight },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    color: buyerColors.textPrimary
  },
  rowMeta: {
    ...mobileTypography.meta,
    color: buyerColors.textMuted
  },
  rowNote: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  rowAmount: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    fontVariant: ["tabular-nums"]
  },
  amountCredit: { color: buyerColors.success },
  amountDebit: { color: buyerColors.textPrimary }
});
