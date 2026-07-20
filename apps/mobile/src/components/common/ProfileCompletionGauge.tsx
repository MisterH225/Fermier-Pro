import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RolePalette } from "./rolePalette";

type Props = {
  percent: number;
  palette: RolePalette;
  label: string;
  ctaLabel: string;
  onPressCta?: () => void;
};

export function ProfileCompletionGauge({
  percent,
  palette,
  label,
  ctaLabel,
  onPressCta
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

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
      <View style={styles.row}>
        <Text style={[styles.label, { color: palette.textPrimary }]}>
          {label.replace("{{percent}}", String(clamped))}
        </Text>
        <Text style={[styles.pct, { color: palette.primary }]}>{clamped}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: palette.primaryLight }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped}%`,
              backgroundColor: palette.primary
            }
          ]}
        />
      </View>
      {onPressCta && clamped < 100 ? (
        <Pressable
          onPress={onPressCta}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: palette.primary,
              borderRadius: palette.radiusButton,
              opacity: pressed ? 0.9 : 1
            }
          ]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[styles.ctaTx, { color: palette.onPrimary }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: mobileSpacing.sm
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  label: { ...mobileTypography.body, fontWeight: "600", flex: 1 },
  pct: { fontWeight: "800", fontSize: 16 },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden"
  },
  fill: { height: "100%", borderRadius: 999 },
  cta: {
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  ctaTx: { fontWeight: "700", fontSize: 14 }
});
