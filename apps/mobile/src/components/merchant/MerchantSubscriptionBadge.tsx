import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing, mobileKpiPalette, mobileStatusSurfaces, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { producerColors } from "../../theme/producerTheme";
import { vetColors } from "../../theme/vetTheme";

type SubscriptionStatus =
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "trialing"
  | null;

type Props = {
  tier: "free" | "premium" | null;
  status?: SubscriptionStatus;
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
  const isTrialing = status === "trialing";
  const isSuspended = status === "suspended";
  const isCancelled = status === "cancelled";
  const label = hasPendingSubscription
    ? t("merchant.subscription.statusPaymentPending")
    : isPastDue
      ? t("merchant.subscription.statusPastDue")
      : isTrialing
        ? t("merchant.subscription.statusTrialing")
        : isSuspended
          ? t("merchant.subscription.statusSuspended")
          : isCancelled
            ? t("merchant.subscription.statusCancelled")
            : isPremium
              ? t("merchant.subscription.premiumTitle")
              : tier === "free"
                ? t("merchant.subscription.freeTitle")
                : t("merchant.dashboard.tierNone");

  const showUpgrade = !isPremium && !isPastDue && !isSuspended;
  const showRenew = isPastDue;

  return (
    <View style={styles.row} testID="merchant-subscription-badge-row">
      <View
        testID="merchant-subscription-badge"
        style={[
          styles.badge,
          isPremium && styles.badgePremium,
          isTrialing && styles.badgeTrial,
          (isPastDue || isSuspended || isCancelled) && styles.badgePastDue
        ]}
      >
        <Text
          style={[
            styles.badgeTx,
            isPremium && styles.badgeTxPremium,
            isTrialing && styles.badgeTxTrial,
            (isPastDue || isSuspended || isCancelled) && styles.badgeTxPastDue
          ]}
        >
          {label}
        </Text>
      </View>
      {showUpgrade ? (
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
              ? t("merchant.subscription.reopenPaymentCta")
              : t("merchant.dashboard.upgradeCta")}
          </Text>
        </Pressable>
      ) : showRenew ? (
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
  badgePremium: { backgroundColor: mobileKpiPalette.dueMonth.bg, borderColor: producerColors.warning },
  badgeTrial: { backgroundColor: producerColors.successMintBg, borderColor: vetColors.success },
  badgePastDue: { backgroundColor: mobileStatusSurfaces.errorBg, borderColor: vetColors.danger },
  badgeTx: { fontWeight: "700", color: merchantColors.primary, fontSize: mobileFontSize.sm },
  badgeTxPremium: { color: producerColors.warningDeep },
  badgeTxTrial: { color: merchantColors.greenText },
  badgeTxPastDue: { color: producerColors.dangerStrong },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: merchantRadius.button,
    backgroundColor: merchantColors.primary
  },
  ctaTx: { color: merchantColors.onPrimary, fontWeight: "700", fontSize: mobileFontSize.sm }
});
