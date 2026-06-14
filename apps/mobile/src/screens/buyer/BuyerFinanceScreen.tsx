import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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
import { BuyerBalanceCard } from "../../components/buyer/BuyerBalanceCard";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { profileScreenScrollContent } from "../../components/layout";
import { formatMarketMoney } from "../../components/marketplace/MarketplaceListingCard";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  fetchBuyerWallet,
  fetchBuyerWalletEntries,
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

function entryIcon(kind: BuyerWalletEntryDto["kind"]): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "credit_refund":
    case "credit_adjustment":
      return "arrow-down-circle";
    case "debit_escrow_hold":
    case "debit_adjustment":
      return "arrow-up-circle";
    default:
      return "swap-horizontal";
  }
}

function isCredit(kind: BuyerWalletEntryDto["kind"]): boolean {
  return kind === "credit_refund" || kind === "credit_adjustment";
}

export function BuyerFinanceScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const walletQ = useQuery({
    queryKey: ["buyerWallet"],
    queryFn: () => fetchBuyerWallet(accessToken!),
    enabled: Boolean(accessToken)
  });

  const entriesQ = useQuery({
    queryKey: ["buyerWalletEntries"],
    queryFn: () => fetchBuyerWalletEntries(accessToken!),
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

  const wallet = walletQ.data;
  const entries = entriesQ.data?.entries ?? [];

  return (
    <BuyerMobileShell omitBottomTabBar>
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
        {walletQ.isLoading ? (
          <ActivityIndicator color={buyerColors.primary} />
        ) : wallet ? (
          <BuyerBalanceCard
            balance={wallet.balance}
            currency={wallet.currency}
            monthCredits={wallet.monthCredits}
          />
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
    </BuyerMobileShell>
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
