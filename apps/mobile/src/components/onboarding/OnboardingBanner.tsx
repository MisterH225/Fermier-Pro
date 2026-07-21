import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";
import { merchantColors } from "../../theme/merchantTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  onComplete: () => void;
};

export function OnboardingBanner({ onComplete }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.banner} testID="onboarding-banner">
      <Text style={styles.icon}>⚠️</Text>
      <View style={styles.textCol}>
        <Text style={styles.text}>{t("onboarding.banner.text")}</Text>
        <Pressable onPress={onComplete} hitSlop={8} testID="onboarding-banner-cta">
          <Text style={styles.cta}>{t("onboarding.banner.cta")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    backgroundColor: producerColors.kpiAmberSoft,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    borderWidth: 1,
    borderColor: uiNamedColors.cFCD34D
  },
  icon: { fontSize: mobileFontSize.xl },
  textCol: { flex: 1 },
  text: {
    ...mobileTypography.body,
    color: merchantColors.amberText,
    fontWeight: "600",
    marginBottom: 4
  },
  cta: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
