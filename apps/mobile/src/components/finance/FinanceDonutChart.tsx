import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type FinanceDonutSlice = {
  label: string;
  value: number;
  color: string;
  /** Montant formaté affiché dans la légende */
  display?: string;
};

type Props = {
  slices: FinanceDonutSlice[];
  size?: number;
  emptyLabel?: string;
};

const CHART_SIZE = 188;
const OUTER_R = 82;
const INNER_R = 54;

/** Teintes éloignées (bleu, orange, violet…) — pas plusieurs verts. */
export const FINANCE_CATEGORY_PALETTE = [
  "#2563EB",
  "#EA580C",
  "#7C3AED",
  "#DC2626",
  "#0891B2",
  "#DB2777",
  "#CA8A04",
  "#4F46E5",
  "#0D9488",
  "#64748B"
] as const;

export function financeCategoryColor(categoryIndex: number): string {
  return FINANCE_CATEGORY_PALETTE[
    categoryIndex % FINANCE_CATEGORY_PALETTE.length
  ]!;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Segment d'anneau (donut) entre startAngle et endAngle (degrés, 0 = haut). */
function donutSegmentPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    const mid = (startAngle + endAngle) / 2;
    const a = donutSegmentPath(cx, cy, rOuter, rInner, startAngle, mid);
    const b = donutSegmentPath(cx, cy, rOuter, rInner, mid, endAngle);
    return `${a} ${b}`;
  }

  const sRad = degToRad(startAngle - 90);
  const eRad = degToRad(endAngle - 90);
  const xOs = cx + rOuter * Math.cos(sRad);
  const yOs = cy + rOuter * Math.sin(sRad);
  const xOe = cx + rOuter * Math.cos(eRad);
  const yOe = cy + rOuter * Math.sin(eRad);
  const xIe = cx + rInner * Math.cos(eRad);
  const yIe = cy + rInner * Math.sin(eRad);
  const xIs = cx + rInner * Math.cos(sRad);
  const yIs = cy + rInner * Math.sin(sRad);
  const large = sweep > 180 ? 1 : 0;

  return [
    `M ${xOs} ${yOs}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${xOe} ${yOe}`,
    `L ${xIe} ${yIe}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${xIs} ${yIs}`,
    "Z"
  ].join(" ");
}

export function FinanceDonutChart({
  slices,
  size = CHART_SIZE,
  emptyLabel = "—"
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / CHART_SIZE;
  const rOuter = OUTER_R * scale;
  const rInner = INNER_R * scale;

  const { segments, topPct } = useMemo(() => {
    const positive = slices.filter((s) => s.value > 0);
    const sum = positive.reduce((acc, s) => acc + s.value, 0);
    if (sum <= 0) {
      return { segments: [], topPct: 0 };
    }

    let angle = 0;
    const segs = positive.map((slice, i) => {
      const sweep = (slice.value / sum) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return {
        ...slice,
        color: financeCategoryColor(i),
        startAngle: start,
        endAngle: end,
        pct: Math.round((slice.value / sum) * 100)
      };
    });

    const top = segs[0]?.pct ?? 0;
    return { segments: segs, topPct: top };
  }, [slices]);

  if (!segments.length) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.chartBox, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {segments.map((seg) => (
            <Path
              key={seg.label}
              d={donutSegmentPath(
                cx,
                cy,
                rOuter,
                rInner,
                seg.startAngle,
                seg.endAngle
              )}
              fill={seg.color}
            />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.centerPct}>{topPct}%</Text>
          <Text style={styles.centerLab} numberOfLines={1}>
            {segments[0]?.label}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        {segments.map((seg) => (
          <View key={seg.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendLab} numberOfLines={1}>
              {seg.label}
            </Text>
            <Text style={styles.legendVal}>
              {seg.display ?? String(seg.value)} ({seg.pct}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: mobileSpacing.md,
    width: "100%"
  },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    paddingVertical: mobileSpacing.lg
  },
  chartBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.lg
  },
  centerPct: {
    fontSize: 22,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    letterSpacing: -0.5
  },
  centerLab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center"
  },
  legend: {
    width: "100%",
    gap: mobileSpacing.xs
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  legendLab: {
    ...mobileTypography.body,
    flex: 1,
    minWidth: 0,
    color: mobileColors.textPrimary
  },
  legendVal: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    flexShrink: 0
  }
});
