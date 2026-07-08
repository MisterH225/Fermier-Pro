import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  tier: "free" | "premium" | null;
  status?: "active" | "past_due" | null;
  hasPendingSubscription?: boolean;
};

export function MerchantSubscriptionBadge({
  tier,
  status,
  hasPendingSubscription = false
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isPremium = tier === "premium";
  const isPastDue = status === "past_due";
  const label = hasPendingSubscription
    ? t("merchant.subscription.statusPaymentPending")
    : isPastDue
    ? t("merchant.subscription.statusPastDue")
    : isPremium
      ? t("merchant.subscription.premiumTitle")
      : tier === "free"
        ? t("merchant.subscription.freeTitle")
        : t("merchant.dashboard.tierNone");

  return (
    <View style={styles.row} testID="merchant-subscription-badge-row">
      <View
        testID="merchant-subscription-badge"
        style={[
          styles.badge,
          isPremium && styles.badgePremium,
          isPastDue && styles.badgePastDue
        ]}
      >
        <Text
          style={[
            styles.badgeTx,
            isPremium && styles.badgeTxPremium,
            isPastDue && styles.badgeTxPastDue
          ]}
        >
          {label}
        </Text>
      </View>
      {!isPremium && !isPastDue ? (
        <Pressable
          testID={
            hasPendingSubscription
              ? "merchant-subscription-confirm-cta"
              : "merchant-subscription-upgrade-cta"
          }
          style={styles.cta}
          onPress={() => navigation.navigate("MerchantSubscription")}
        >
          <Text style={styles.ctaTx}>
            {hasPendingSubscription
              ? t("merchant.subscription.confirmPaymentCta")
              : t("merchant.dashboard.upgradeCta")}
          </Text>
        </Pressable>
      ) : isPastDue ? (
        <Pressable
          testID="merchant-subscription-renew-cta"
          style={styles.cta}
          onPress={() => navigation.navigate("MerchantSubscription")}
        >
          <Text style={styles.ctaTx}>{t("merchant.subscription.renewCta")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: mobileSpacing.sm, flexWrap: "wrap" },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: merchantRadius.pill,
    backgroundColor: merchantColors.primaryLight,
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  badgePremium: { backgroundColor: "#FFF8E1", borderColor: "#F59E0B" },
  badgePastDue: { backgroundColor: "#FEE2E2", borderColor: "#EF4444" },
  badgeTx: { fontWeight: "700", color: merchantColors.primary, fontSize: 13 },
  badgeTxPremium: { color: "#B45309" },
  badgeTxPastDue: { color: "#B91C1C" },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: merchantRadius.button,
    backgroundColor: merchantColors.primary
  },
  ctaTx: { color: merchantColors.onPrimary, fontWeight: "700", fontSize: 13 }
});
