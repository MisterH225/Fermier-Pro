import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileStatusSurfaces,
  mobileTypography
} from "../../theme/mobileTheme";

export type HealthVerifiedBadgeSize = "compact" | "detail";

type Props = {
  /** Libellé d'expiration producteur (ex. « Expire dans 5 j ») — remplace le libellé standard. */
  warningLabel?: string | null;
  size?: HealthVerifiedBadgeSize;
  style?: StyleProp<ViewStyle>;
};

/**
 * Badge « Santé vérifiée » — pictogramme + libellé.
 * Affiché uniquement quand la ferme est dans la fenêtre de validité
 * (pas de variante négative « non vérifié »).
 */
export function HealthVerifiedBadge({
  warningLabel,
  size = "compact",
  style
}: Props) {
  const { t } = useTranslation();
  const isWarning = Boolean(warningLabel);
  const isDetail = size === "detail";
  const iconSize = isDetail ? 18 : 12;
  const iconColor = isWarning
    ? mobileStatusSurfaces.warningText
    : mobileStatusSurfaces.successText;

  return (
    <View
      style={[
        styles.base,
        isDetail ? styles.detail : styles.compact,
        isWarning && styles.warning,
        style
      ]}
      accessibilityRole="text"
      accessibilityLabel={
        warningLabel ?? t("marketScreen.badgeHealthVerified")
      }
    >
      <Ionicons
        name={isWarning ? "time-outline" : "shield-checkmark"}
        size={iconSize}
        color={iconColor}
      />
      <Text
        style={[
          styles.label,
          isDetail && styles.labelDetail,
          isWarning && styles.labelWarning
        ]}
        numberOfLines={1}
      >
        {warningLabel ?? t("marketScreen.badgeHealthVerified")}
      </Text>
    </View>
  );
}

/** Préfixe « Dr » si le nom API ne l'inclut pas déjà. */
export function formatVetDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (/^dr\.?\s/i.test(trimmed)) return trimmed;
  return `Dr ${trimmed}`;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mobileStatusSurfaces.successBg,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.success + "55"
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "70%"
  },
  detail: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6
  },
  warning: {
    backgroundColor: mobileStatusSurfaces.warningBg,
    borderColor: mobileStatusSurfaces.warningText + "55"
  },
  label: {
    ...mobileTypography.meta,
    color: mobileStatusSurfaces.successText,
    fontWeight: "700",
    fontSize: mobileFontSize.xs
  },
  labelDetail: {
    fontSize: mobileFontSize.sm
  },
  labelWarning: {
    color: mobileStatusSurfaces.warningText
  }
});
