import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { merchantColors } from "../../theme/merchantTheme";
import { mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  variant: "shop" | "product";
  onPress: () => void;
};

export function MerchantOnboardingNudgeBanner({ variant, onPress }: Props) {
  const { t } = useTranslation();
  const key =
    variant === "shop"
      ? "merchant.dashboard.nudgeShop"
      : "merchant.dashboard.nudgeProduct";
  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <Text style={styles.text}>{t(key)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: mobileSpacing.lg,
    marginBottom: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: merchantColors.warnBannerBg,
    borderWidth: 1,
    borderColor: merchantColors.warning
  },
  text: {
    color: merchantColors.textPrimary,
    fontWeight: "600"
  }
});
