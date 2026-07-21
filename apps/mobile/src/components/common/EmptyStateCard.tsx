import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { producerPalette, type RolePalette } from "./rolePalette";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  onConfigure?: () => void;
  title?: string;
  subtitle?: string;
  icon?: IconName;
  palette?: RolePalette;
};

export function EmptyStateCard({
  onConfigure,
  title,
  subtitle,
  icon = "folder-open-outline",
  palette = producerPalette
}: Props) {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.border,
          borderRadius: palette.radiusCard
        }
      ]}
    >
      <Ionicons
        name={icon}
        size={40}
        color={palette.textSecondary}
        style={styles.icon}
      />
      <Text style={[styles.title, { color: palette.textPrimary }]}>
        {title ?? t("onboarding.emptyState.title")}
      </Text>
      {subtitle === undefined && !title ? (
        <Text style={[styles.sub, { color: palette.textSecondary }]}>
          {t("onboarding.emptyState.subtitle")}
        </Text>
      ) : subtitle ? (
        <Text style={[styles.sub, { color: palette.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
      {onConfigure ? (
        <Pressable style={styles.cta} onPress={onConfigure}>
          <Text style={[styles.ctaText, { color: palette.primary }]}>
            {t("onboarding.emptyState.cta")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: mobileSpacing.lg,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth
  },
  icon: { marginBottom: mobileSpacing.sm },
  title: {
    ...mobileTypography.body,
    fontWeight: "700",
    textAlign: "center"
  },
  sub: {
    ...mobileTypography.meta,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18
  },
  cta: { marginTop: mobileSpacing.md },
  ctaText: {
    fontWeight: "700",
    fontSize: mobileFontSize.md
  }
});
