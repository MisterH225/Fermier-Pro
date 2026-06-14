import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMarketMoney } from "../marketplace/MarketplaceListingCard";
import { buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  balance: number;
  currency: string;
  monthCredits?: number;
  onPress?: () => void;
};

export function BuyerBalanceCard({
  balance,
  currency,
  monthCredits = 0,
  onPress
}: Props) {
  const { t } = useTranslation();
  const formatted = formatMarketMoney(Math.round(balance), currency);
  const monthLabel =
    monthCredits > 0
      ? t("buyer.wallet.monthCredits", {
          amount: formatMarketMoney(Math.round(monthCredits), currency)
        })
      : t("buyer.wallet.monthCreditsEmpty");

  const content = (
    <View style={styles.card}>
      <Text style={styles.label}>{t("buyer.wallet.availableBalance")}</Text>
      <Text style={styles.amount}>{formatted}</Text>
      <View style={styles.footer}>
        <Text style={styles.month}>{monthLabel}</Text>
        {monthCredits > 0 ? (
          <View style={styles.badge}>
            <Ionicons name="trending-up" size={12} color="#4ADE80" />
            <Text style={styles.badgeText}>
              {t("buyer.wallet.refundsBadge")}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.94 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#2D2E35",
    borderRadius: buyerRadius.card + 4,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.xs
  },
  label: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500"
  },
  amount: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm,
    gap: mobileSpacing.sm
  },
  month: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.85)",
    flex: 1
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: buyerRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  badgeText: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600"
  }
});
