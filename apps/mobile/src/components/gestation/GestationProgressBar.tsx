import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  progressPct: number;
  weekLabel: string;
};

export function GestationProgressBar({ progressPct, weekLabel }: Props) {
  const pct = Math.min(100, Math.max(0, progressPct));
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.label}>
        {weekLabel} · {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.xs },
  track: {
    height: 8,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill
  },
  label: { fontSize: 12, color: mobileColors.textSecondary }
});
