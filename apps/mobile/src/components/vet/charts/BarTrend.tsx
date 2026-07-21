import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { vetColors, vetRadius, vetType } from "../../../theme/vetTheme";
import { mobileSpacing, mobileRadius, mobileFontSize } from "../../../theme/mobileTheme";

export type BarTrendPoint = {
  key: string;
  label: string;
  value: number;
  /** Barre mise en avant (ex. mois du pic) — couleur + libellé, jamais couleur seule. */
  highlight?: boolean;
};

type Props = {
  points: BarTrendPoint[];
  emptyLabel: string;
  height?: number;
  /** Libellé a11y du pic (affiché sous le graphique si présent). */
  peakHint?: string | null;
};

const CHART_H = 120;
const PAD = 4;

export function BarTrend({
  points,
  emptyLabel,
  height = CHART_H,
  peakHint
}: Props) {
  const max = useMemo(
    () => Math.max(1, ...points.map((p) => p.value)),
    [points]
  );

  if (points.length === 0) {
    return (
      <View style={styles.empty} accessibilityRole="text">
        <View style={styles.emptyIcon} />
        <Text style={styles.emptyTx}>{emptyLabel}</Text>
      </View>
    );
  }

  const barW = Math.max(8, Math.floor(280 / points.length) - 6);
  const gap = 6;
  const width = points.length * (barW + gap);

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height} accessibilityRole="image">
        {points.map((p, i) => {
          const h = Math.max(2, (p.value / max) * (height - 28));
          const x = i * (barW + gap);
          const y = height - 20 - h;
          return (
            <Rect
              key={p.key}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              fill={p.highlight ? vetColors.danger : vetColors.primary}
            />
          );
        })}
      </Svg>
      <View style={[styles.labels, { width }]}>
        {points.map((p) => (
          <Text
            key={p.key}
            style={[styles.lab, p.highlight && styles.labPeak]}
            numberOfLines={1}
          >
            {p.label}
            {p.highlight ? " ▲" : ""}
          </Text>
        ))}
      </View>
      {peakHint ? <Text style={styles.peakHint}>{peakHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.xs, alignItems: "center" },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  lab: {
    ...vetType.label,
    flex: 1,
    textAlign: "center",
    fontSize: mobileFontSize.xs
  },
  labPeak: { color: vetColors.danger, fontWeight: "700" },
  peakHint: { ...vetType.label, color: vetColors.danger, textAlign: "center" },
  empty: {
    minHeight: CHART_H,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.lg,
    backgroundColor: vetColors.primaryLight,
    borderRadius: vetRadius.button
  },
  emptyIcon: {
    width: 36,
    height: 28,
    borderRadius: mobileRadius.sm,
    backgroundColor: vetColors.primaryMuted,
    opacity: 0.7
  },
  emptyTx: { ...vetType.label, textAlign: "center", paddingHorizontal: PAD }
});
