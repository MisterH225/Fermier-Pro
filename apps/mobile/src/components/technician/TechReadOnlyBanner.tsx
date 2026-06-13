import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors, techRadius } from "../../theme/technicianTheme";

export function TechReadOnlyBanner() {
  const { t } = useTranslation();

  return (
    <View style={styles.banner} accessibilityRole="text">
      <Text style={styles.text}>{t("tech.readOnlyBanner")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: techColors.primaryLight,
    borderRadius: techRadius.card,
    borderWidth: 1,
    borderColor: techColors.border,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  text: {
    ...mobileTypography.meta,
    color: techColors.textSecondary,
    lineHeight: 18
  }
});
