import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  score: number;
  band: string;
  onPressDetails?: () => void;
};

export function FarmScoreGauge({ score, band, onPressDetails }: Props) {
  const { t } = useTranslation();
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const color = useMemo(() => {
    if (s >= 85) return mobileColors.success;
    if (s >= 65) return mobileColors.accent;
    if (s >= 45) return mobileColors.warning;
    return mobileColors.error;
  }, [s]);

  const size = 168;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const dash = (s / 100) * C;

  return (
    <Pressable
      onPress={onPressDetails}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={t("reportsScreen.scoreA11y", { score: s, band })}
    >
      <View style={styles.svgBox}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${cx} ${cy})`}>
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              stroke={mobileColors.border}
              strokeWidth={stroke}
              fill="none"
            />
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash}, ${C}`}
            />
          </G>
        </Svg>
        <View style={styles.centerText} pointerEvents="none">
          <Text style={styles.score}>{s}</Text>
          <Text style={styles.band}>{band}</Text>
        </View>
      </View>
      <Text style={styles.hint}>{t("reportsScreen.bankHint")}</Text>
      <Text style={styles.tap}>{t("reportsScreen.scoreTapDetail")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.background
  },
  svgBox: { width: 168, height: 168, justifyContent: "center", alignItems: "center" },
  centerText: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  score: {
    fontSize: 36,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  band: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg
  },
  tap: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    marginTop: mobileSpacing.xs,
    fontWeight: "600"
  }
});
