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
import { useRolePalette } from "../../hooks/useRolePalette";
import { fetchUserWalletEntries } from "../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography,
  mobileStatusSurfaces,
  mobileRadius,
  mobileFontSize
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import {
  isWalletEntryCredit,
  walletEntryIcon,
  walletEntryLabel
} from "./walletEntryUi";

type Props = {
  accentColor?: string;
};

export function WalletHistoryList({ accentColor }: Props) {
  const { t } = useTranslation();
  const palette = useRolePalette();
  const accent = accentColor ?? palette.primary;
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
        <ActivityIndicator color={accent} style={styles.loader} />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="wallet-outline"
            size={40}
            color={palette.textMuted}
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
                  {
                    borderRadius: palette.radiusCard,
                    backgroundColor: palette.cardBg,
                    borderColor: palette.border
                  },
                  pressed && entry.transactionId && { opacity: 0.9 }
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    credit
                      ? styles.iconCredit
                      : { backgroundColor: palette.primaryLight }
                  ]}
                >
                  <Ionicons
                    name={walletEntryIcon(entry.kind)}
                    size={20}
                    color={credit ? palette.success : accent}
                  />
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
                    {walletEntryLabel(entry.kind, t)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: palette.textMuted }]}>
                    {new Date(entry.createdAt).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Text>
                  {entry.note ? (
                    <Text
                      style={[styles.rowNote, { color: palette.textSecondary }]}
                      numberOfLines={2}
                    >
                      {entry.note}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.rowAmount,
                    credit
                      ? { color: palette.success }
                      : { color: palette.textPrimary }
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
    color: mobileColors.textPrimary
  },
  sectionSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  loader: { marginTop: mobileSpacing.lg },
  empty: {
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xl
  },
  emptyTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  emptyBody: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  list: { gap: mobileSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center"
  },
  iconCredit: { backgroundColor: mobileStatusSurfaces.positiveBg },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md
  },
  rowMeta: {
    ...mobileTypography.meta
  },
  rowNote: {
    ...mobileTypography.meta
  },
  rowAmount: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    fontVariant: ["tabular-nums"]
  }
});
