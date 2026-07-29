import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { merchantColors } from "../../theme/merchantTheme";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";

type Props = {
  role: "producer" | "merchant";
  onUpgrade: () => void;
};

export function WriteLockedBanner({ role, onUpgrade }: Props) {
  const { t } = useTranslation();
  const accent = role === "merchant" ? merchantColors.primary : producerColors.primary;
  const bg =
    role === "merchant" ? merchantColors.warnBannerBg : producerColors.oliveWash;

  return (
    <View
      style={[styles.wrap, { backgroundColor: bg, borderColor: accent }]}
      testID="write-locked-banner"
    >
      <Text style={styles.text}>
        {role === "merchant"
          ? t("subscriptionLimits.writeLocked.shopBanner")
          : t("subscriptionLimits.writeLocked.farmBanner")}
      </Text>
      <Pressable
        style={[styles.cta, { backgroundColor: accent }]}
        onPress={onUpgrade}
        testID="write-locked-upgrade"
      >
        <Text style={styles.ctaTx}>
          {t("subscriptionLimits.writeLocked.upgradeCta")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  text: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  cta: {
    alignSelf: "flex-start",
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10
  },
  ctaTx: {
    color: mobileColors.onAccent,
    fontWeight: "700"
  }
});
