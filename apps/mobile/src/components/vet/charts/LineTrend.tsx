import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { vetColors, vetRadius, vetType } from "../../../theme/vetTheme";
import { mobileSpacing } from "../../../theme/mobileTheme";

export type LineTrendPoint = {
  key: string;
  label: string;
  value: number | null;
};

type Props = {
  points: LineTrendPoint[];
  /** Objectif (ligne pointillée) — null = pas de ligne. */
  target?: number | null;
  emptyLabel: string;
  targetLabel?: string;
  height?: number;
};

const W = 300;
const H = 140;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;

export function LineTrend({
  points,
  target,
  emptyLabel,
  targetLabel,
  height = H
}: Props) {
  const layout = useMemo(() => {
    const values = points
      .map((p) => p.value)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length === 0) {
      return null;
    }
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (target != null && Number.isFinite(target)) {
      lo = Math.min(lo, target);
      hi = Math.max(hi, target);
    }
    if (lo === hi) {
      hi = lo + 1;
    }
    const plotH = height - PAD_T - PAD_B;
    const plotW = W - PAD_L - PAD_R;
    const usable = points.filter(
      (p): p is LineTrendPoint & { value: number } => p.value != null
    );
    const coords = usable.map((p, i) => {
      const x =
        PAD_L +
        (usable.length === 1 ? plotW / 2 : (i / (usable.length - 1)) * plotW);
      const y = PAD_T + plotH - ((p.value - lo) / (hi - lo)) * plotH;
      return { x, y, key: p.key };
    });
    const pathPts = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const targetY =
      target != null && Number.isFinite(target)
        ? PAD_T + plotH - ((target - lo) / (hi - lo)) * plotH
        : null;
    return { pathPts, targetY, coords };
  }, [points, target, height]);

  if (!layout) {
    return (
      <View style={styles.empty} accessibilityRole="text">
        <View style={styles.emptyIcon} />
        <Text style={styles.emptyTx}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={height} accessibilityRole="image">
        {layout.targetY != null ? (
          <Line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={layout.targetY}
            y2={layout.targetY}
            stroke={vetColors.warning}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        ) : null}
        <Polyline
          points={layout.pathPts}
          fill="none"
          stroke={vetColors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {layout.coords.map((c) => (
          <Circle
            key={c.key}
            cx={c.x}
            cy={c.y}
            r={3.5}
            fill={vetColors.cardBg}
            stroke={vetColors.primary}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View style={styles.labels}>
        {points.map((p) => (
          <Text key={p.key} style={styles.lab} numberOfLines={1}>
            {p.label}
          </Text>
        ))}
      </View>
      {target != null && targetLabel ? (
        <Text style={styles.targetHint}>
          {targetLabel}: {Math.round(target)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.xs, alignItems: "center" },
  labels: {
    flexDirection: "row",
    width: W,
    justifyContent: "space-between"
  },
  lab: { ...vetType.label, flex: 1, textAlign: "center", fontSize: 10 },
  targetHint: {
    ...vetType.label,
    color: vetColors.warningDeep,
    textAlign: "center"
  },
  empty: {
    minHeight: H,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.lg,
    backgroundColor: vetColors.primaryLight,
    borderRadius: vetRadius.button
  },
  emptyIcon: {
    width: 40,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: vetColors.primaryMuted,
    borderStyle: "dashed"
  },
  emptyTx: { ...vetType.label, textAlign: "center" }
});
