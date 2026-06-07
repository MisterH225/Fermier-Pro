import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  onConfigure?: () => void;
  title?: string;
  subtitle?: string;
};

export function EmptyStateCard({ onConfigure, title, subtitle }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Ionicons
        name="folder-open-outline"
        size={40}
        color={mobileColors.textSecondary}
        style={styles.icon}
      />
      <Text style={styles.title}>
        {title ?? t("onboarding.emptyState.title")}
      </Text>
      <Text style={styles.sub}>
        {subtitle ?? t("onboarding.emptyState.subtitle")}
      </Text>
      {onConfigure ? (
        <Pressable style={styles.cta} onPress={onConfigure}>
          <Text style={styles.ctaText}>{t("onboarding.emptyState.cta")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  icon: { marginBottom: mobileSpacing.sm },
  title: {
    ...mobileTypography.body,
    fontWeight: "700",
    textAlign: "center",
    color: mobileColors.textPrimary
  },
  sub: {
    ...mobileTypography.meta,
    textAlign: "center",
    color: mobileColors.textSecondary,
    marginTop: 6,
    lineHeight: 18
  },
  cta: { marginTop: mobileSpacing.md },
  ctaText: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: 15
  }
});
