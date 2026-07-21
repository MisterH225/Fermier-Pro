import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { formatFinanceChartValue } from "../finance/financeChartFormat";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { ChartLegend } from "./ChartLegend";
import { ChartMonthSelector } from "./ChartMonthSelector";
import { ChartTooltip } from "./ChartTooltip";
import {
  approximatePathLength,
  monotoneCurvePath,
  type ChartPoint
} from "./chartInterpolation";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHART_H = 200;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 16;
const PAD_B = 8;
const COMPACT_PAD_L = 0;
const COMPACT_PAD_R = 0;
const COMPACT_PAD_T = 2;
const COMPACT_PAD_B = 2;

export type SmartChartPeriod = "3M" | "6M" | "12M";

export type SmartChartLine = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  data: { month: string; value: number; limitedData?: boolean }[];
};

export type SmartChartSummaryStat = {
  label: string;
  value: number;
  delta?: number;
};

export type SmartChartProps = {
  lines: SmartChartLine[];
  period?: SmartChartPeriod;
  onPeriodChange?: (period: SmartChartPeriod) => void;
  unit?: string;
  summaryStats?: SmartChartSummaryStat[];
  formatValue?: (value: number) => string;
  monthLabel?: (monthKey: string) => string;
  /** Données déjà dimensionnées par l’API (ex. stock aliment par semaine). */
  skipPeriodSlice?: boolean;
  height?: number;
  /** Mode compact (sparkline KPI) — sans pills ni stats. */
  compact?: boolean;
  emptyLabel?: string;
};

const PERIOD_OPTIONS: SmartChartPeriod[] = ["3M", "6M", "12M"];

function sliceByPeriod(
  lines: SmartChartLine[],
  period: SmartChartPeriod,
  skip?: boolean
): SmartChartLine[] {
  if (skip) {
    return lines;
  }
  const n = period === "3M" ? 3 : period === "6M" ? 6 : 12;
  return lines.map((line) => ({
    ...line,
    data: line.data.slice(-n)
  }));
}

function computeAutoSummary(
  lines: SmartChartLine[],
  formatValue: (v: number) => string
): SmartChartSummaryStat[] {
  return lines.map((line) => {
    const values = line.data.map((d) => d.value);
    const avg =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;
    const last = values[values.length - 1] ?? 0;
    const prev = values[values.length - 2] ?? 0;
    const delta =
      prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : undefined;
    return {
      label: line.label,
      value: avg,
      delta
    };
  });
}

export function SmartChart({
  lines,
  period = "6M",
  onPeriodChange,
  unit,
  summaryStats,
  formatValue,
  monthLabel,
  skipPeriodSlice = false,
  height = CHART_H,
  compact = false,
  emptyLabel = "—"
}: SmartChartProps) {
  const fmt =
    formatValue ??
    ((v: number) => {
      const core = formatFinanceChartValue(v, unit);
      return core;
    });
  const labelMonth =
    monthLabel ??
    ((m: string) => {
      const [y, mo] = m.split("-").map(Number);
      if (!y || !mo) return m.slice(0, 3);
      return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("fr-FR", {
        month: "short"
      });
    });

  const slicedLines = useMemo(
    () => sliceByPeriod(lines, period, skipPeriodSlice),
    [lines, period, skipPeriodSlice]
  );

  const monthKeys = slicedLines[0]?.data.map((d) => d.month) ?? [];
  const lastMonthKey = monthKeys[monthKeys.length - 1] ?? "";
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, monthKeys.length - 1)
  );
  const [width, setWidth] = useState(0);
  const drawAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setSelectedIndex(Math.max(0, monthKeys.length - 1));
  }, [monthKeys.length, period, lastMonthKey]);

  useEffect(() => {
    if (compact) {
      drawAnim.setValue(1);
      return;
    }
    drawAnim.setValue(0);
    Animated.timing(drawAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: false
    }).start();
  }, [slicedLines, width, drawAnim, compact]);

  const padL = compact ? COMPACT_PAD_L : PAD_L;
  const padR = compact ? COMPACT_PAD_R : PAD_R;
  const padT = compact ? COMPACT_PAD_T : PAD_T;
  const padB = compact ? COMPACT_PAD_B : PAD_B;

  const innerW = Math.max(compact ? 24 : 40, width - padL - padR);
  const innerH = Math.max(compact ? 20 : 40, height - padT - padB);

  const { minY, maxY } = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const line of slicedLines) {
      for (const d of line.data) {
        if (!Number.isFinite(d.value)) {
          continue;
        }
        min = Math.min(min, d.value);
        max = Math.max(max, d.value);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { minY: 0, maxY: 1 };
    }
    if (min === max) {
      const bump = Math.abs(min) * 0.12 || 1;
      return { minY: min - bump, maxY: max + bump };
    }
    const span = max - min;
    const margin = span * 0.08;
    return { minY: min - margin, maxY: max + margin };
  }, [slicedLines]);

  const xAt = (i: number, n: number) =>
    n <= 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1);
  const yAt = (v: number) =>
    padT + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const seriesGeometry = useMemo(() => {
    const n = monthKeys.length;
    return slicedLines.map((line) => {
      const pts: ChartPoint[] = line.data.map((d, i) => ({
        x: xAt(i, n),
        y: yAt(d.value)
      }));
      const path = monotoneCurvePath(pts);
      const pathLen = approximatePathLength(pts);
      return { line, pts, path, pathLen };
    });
  }, [slicedLines, monthKeys.length, innerW, innerH, minY, maxY, padL, padT]);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const stats =
    summaryStats ??
    (compact ? [] : computeAutoSummary(slicedLines, fmt));

  const primaryGeom = seriesGeometry[0];
  const tooltipPoint = primaryGeom?.pts[selectedIndex];
  const tooltipValue =
    primaryGeom?.line.data[selectedIndex]?.value ?? 0;

  if (!monthKeys.length || !slicedLines.length) {
    return (
      <Text style={styles.empty}>{emptyLabel}</Text>
    );
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {!compact && onPeriodChange ? (
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((p) => (
            <Pressable
              key={p}
              onPress={() => onPeriodChange(p)}
              style={[styles.periodChip, period === p && styles.periodChipOn]}
            >
              <Text
                style={[
                  styles.periodTx,
                  period === p && styles.periodTxOn
                ]}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!compact ? (
        <View style={styles.headerValues}>
          {slicedLines.map((line) => {
            const v = line.data[selectedIndex]?.value ?? 0;
            return (
              <View key={line.key} style={styles.headerCell}>
                <Text style={[styles.headerVal, { color: line.color }]}>
                  {fmt(v)}
                </Text>
                <Text style={styles.headerLab} numberOfLines={1}>
                  {line.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.chartBox, { height }]}>
        {width > 0 ? (
        <Svg width={width} height={height}>
          {!compact
            ? [0.25, 0.5, 0.75].map((ratio) => {
                const y = padT + innerH * (1 - ratio);
                return (
                  <Line
                    key={ratio}
                    x1={padL}
                    y1={y}
                    x2={padL + innerW}
                    y2={y}
                    stroke={mobileColors.textPrimary}
                    strokeOpacity={0.1}
                    strokeWidth={1}
                  />
                );
              })
            : null}

          {!compact && tooltipPoint ? (
            <Line
              x1={tooltipPoint.x}
              y1={padT}
              x2={tooltipPoint.x}
              y2={padT + innerH}
              stroke={mobileColors.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}

          {seriesGeometry.map(({ line, path, pathLen }) => {
            if (compact) {
              return (
                <Path
                  key={line.key}
                  d={path}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            const offset = drawAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [pathLen, 0]
            });
            return (
              <AnimatedPath
                key={line.key}
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLen}
                strokeDashoffset={offset}
              />
            );
          })}

          {!compact
            ? seriesGeometry.map(({ line, pts }) =>
                pts.map((pt, pi) =>
                  pi === selectedIndex ? (
                    <Circle
                      key={`${line.key}-${pi}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={5}
                      fill={mobileColors.background}
                      stroke={line.color}
                      strokeWidth={2}
                    />
                  ) : null
                )
              )
            : null}
        </Svg>
        ) : null}

        {!compact && tooltipPoint ? (
          <ChartTooltip
            value={fmt(tooltipValue)}
            left={tooltipPoint.x}
            top={tooltipPoint.y}
          />
        ) : null}
      </View>

      {!compact ? (
        <>
          <ChartMonthSelector
            months={monthKeys}
            labels={monthKeys.map(labelMonth)}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
          <ChartLegend
            items={slicedLines.map((l) => ({
              key: l.key,
              label: l.label,
              color: l.color
            }))}
          />
          {stats.length > 0 ? (
            <View style={styles.statsRow}>
              {stats.map((s, i) => (
                <View key={`${s.label}-${i}`} style={styles.statCard}>
                  <Text style={styles.statLab}>{s.label}</Text>
                  <Text style={styles.statVal}>{fmt(s.value)}</Text>
                  {s.delta != null && Number.isFinite(s.delta) ? (
                    <Text
                      style={[
                        styles.statDelta,
                        s.delta >= 0 ? styles.deltaUp : styles.deltaDown
                      ]}
                    >
                      {s.delta >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(s.delta).toFixed(1)}%
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden" },
  chartBox: {
    width: "100%",
    overflow: "hidden"
  },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    paddingVertical: mobileSpacing.lg
  },
  periodRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.xs,
    marginBottom: mobileSpacing.sm
  },
  periodChip: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill
  },
  periodChipOn: { backgroundColor: mobileColors.surfaceMuted },
  periodTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  periodTxOn: { color: mobileColors.textPrimary },
  headerValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm
  },
  headerCell: { minWidth: 80 },
  headerVal: {
    fontSize: mobileFontSize.xl,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  headerLab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.md
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md
  },
  statLab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  statVal: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: 4
  },
  statDelta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    marginTop: 4
  },
  deltaUp: { color: mobileColors.success },
  deltaDown: { color: mobileColors.error }
});
