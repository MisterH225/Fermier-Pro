import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { confidenceLevel } from "./predictionFormatters";
import { mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

const COLORS = {
  high: uiNamedColors.c1D9E75,
  medium: uiNamedColors.cBA7517,
  low: uiNamedColors.cB4B2A9
} as const;

type Props = {
  confidence: number;
};

export function ConfidenceBadge({ confidence }: Props) {
  const { t } = useTranslation();
  const level = confidenceLevel(confidence);
  const color = COLORS[level];

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>
        {t(`predictions.confidence.${level}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: mobileRadius.sm
  },
  text: {
    ...mobileTypography.meta,
    fontWeight: "600"
  }
});
