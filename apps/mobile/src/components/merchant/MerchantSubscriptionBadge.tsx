import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  tier: "free" | "premium" | null;
};

export function MerchantSubscriptionBadge({ tier }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isPremium = tier === "premium";
  const label = isPremium
    ? t("merchant.subscription.premiumTitle")
    : tier === "free"
      ? t("merchant.subscription.freeTitle")
      : t("merchant.dashboard.tierNone");

  return (
    <View style={styles.row}>
      <View style={[styles.badge, isPremium && styles.badgePremium]}>
        <Text style={[styles.badgeTx, isPremium && styles.badgeTxPremium]}>{label}</Text>
      </View>
      {!isPremium ? (
        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate("MerchantSubscription")}
        >
          <Text style={styles.ctaTx}>{t("merchant.dashboard.upgradeCta")}</Text>
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
  badgeTx: { fontWeight: "700", color: merchantColors.primary, fontSize: 13 },
  badgeTxPremium: { color: "#B45309" },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: merchantRadius.button,
    backgroundColor: merchantColors.primary
  },
  ctaTx: { color: merchantColors.onPrimary, fontWeight: "700", fontSize: 13 }
});
