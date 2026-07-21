import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { formatMarketMoney } from "../marketplace/MarketplaceListingCard";
import { useSession } from "../../context/SessionContext";
import { fetchUserWalletEntries } from "../../lib/api";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import {
  isWalletEntryCredit,
  walletEntryIcon,
  walletEntryLabel
} from "./walletEntryUi";

type Props = {
  accentColor?: string;
};

export function WalletHistoryList({ accentColor = buyerColors.primary }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken } = useSession();

  const entriesQ = useQuery({
    queryKey: ["userWalletEntries"],
    queryFn: () => fetchUserWalletEntries(accessToken!),
    enabled: Boolean(accessToken)
  });

  const entries = entriesQ.data?.entries ?? [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t("buyer.finance.history")}</Text>
      <Text style={styles.sectionSub}>{t("buyer.finance.historyHint")}</Text>

      {entriesQ.isLoading ? (
        <ActivityIndicator color={accentColor} style={styles.loader} />
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
            const credit = isWalletEntryCredit(entry.kind);
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
                    name={walletEntryIcon(entry.kind)}
                    size={20}
                    color={credit ? buyerColors.success : buyerColors.primary}
                  />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>
                    {walletEntryLabel(entry.kind, t)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  sectionTitle: {
    ...mobileTypography.sectionTitle,
    color: buyerColors.textPrimary
  },
  sectionSub: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
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
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center"
  },
  iconCredit: { backgroundColor: mobileStatusSurfaces.positiveBg },
  iconDebit: { backgroundColor: buyerColors.primaryLight },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
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
    fontSize: mobileFontSize.md,
    fontVariant: ["tabular-nums"]
  },
  amountCredit: { color: buyerColors.success },
  amountDebit: { color: buyerColors.textPrimary }
});
