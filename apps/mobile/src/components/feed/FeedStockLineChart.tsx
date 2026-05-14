import { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { FarmFeedChartDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const CHART_H = 200;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;

type Props = {
  title: string;
  chart: FarmFeedChartDto | undefined;
  period: "3m" | "6m" | "12m";
  onPeriodChange: (p: "3m" | "6m" | "12m") => void;
  periodLabels: { key: "3m" | "6m" | "12m"; label: string }[];
};

export function FeedStockLineChart({
  title,
  chart,
  period,
  onPeriodChange,
  periodLabels
}: Props) {
  const [w, setW] = useState(320);
  const [sel, setSel] = useState<{
    seriesIdx: number;
    pointIdx: number;
  } | null>(null);

  const innerW = Math.max(120, w - PAD_L - PAD_R);
  const innerH = CHART_H - PAD_T - PAD_B;

  const maxY = useMemo(() => {
    if (!chart?.series?.length) return 1;
    let m = 1;
    for (const s of chart.series) {
      for (const v of s.points) {
        if (Number.isFinite(v)) m = Math.max(m, v);
      }
    }
    return m;
  }, [chart]);

  const onLayout = (e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width);
  };

  const xAt = (i: number, n: number) =>
    n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1);

  const yAt = (v: number) => PAD_T + innerH - (v / maxY) * innerH;

  if (!chart || !chart.monthKeys.length) {
    return (
      <View style={{ padding: mobileSpacing.md }}>
        <Text style={{ ...mobileTypography.meta, color: mobileColors.textSecondary }}>
          —
        </Text>
      </View>
    );
  }

  const n = chart.monthKeys.length;
  const tooltip =
    sel != null && chart.series[sel.seriesIdx]
      ? {
          name: chart.series[sel.seriesIdx].name,
          month: chart.monthKeys[sel.pointIdx],
          qty: chart.series[sel.seriesIdx].points[sel.pointIdx] ?? 0,
          color: chart.series[sel.seriesIdx].color
        }
      : null;

  return (
    <View
      style={{
        backgroundColor: mobileColors.surface,
        borderRadius: mobileRadius.lg,
        padding: mobileSpacing.md,
        ...mobileShadows.card
      }}
      onLayout={onLayout}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: mobileSpacing.sm
        }}
      >
        <Text style={{ ...mobileTypography.cardTitle, color: mobileColors.textPrimary }}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", gap: mobileSpacing.xs }}>
          {periodLabels.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => onPeriodChange(p.key)}
              style={{
                paddingHorizontal: mobileSpacing.sm,
                paddingVertical: 4,
                borderRadius: mobileRadius.pill,
                backgroundColor:
                  period === p.key ? mobileColors.accentSoft : mobileColors.surfaceMuted
              }}
            >
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 12,
                  color: mobileColors.textPrimary
                }}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Svg width={w} height={CHART_H}>
        <Line
          x1={PAD_L}
          y1={PAD_T + innerH}
          x2={PAD_L + innerW}
          y2={PAD_T + innerH}
          stroke={mobileColors.border}
          strokeWidth={1}
        />
        {chart.series.map((s, si) => {
          const pts = s.points
            .map((v, i) => `${xAt(i, n)},${yAt(v)}`)
            .join(" ");
          return (
            <Polyline
              key={s.feedTypeId}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={sel?.seriesIdx === si ? 3 : 2}
            />
          );
        })}
        {chart.series.map((s, si) =>
          s.points.map((v, pi) => (
            <Circle
              key={`${s.feedTypeId}-${pi}`}
              cx={xAt(pi, n)}
              cy={yAt(v)}
              r={sel?.seriesIdx === si && sel.pointIdx === pi ? 7 : 5}
              fill={s.color}
              opacity={0.95}
              onPress={() => setSel({ seriesIdx: si, pointIdx: pi })}
            />
          ))
        )}
      </Svg>

      {tooltip ? (
        <View
          style={{
            marginTop: mobileSpacing.xs,
            padding: mobileSpacing.sm,
            backgroundColor: mobileColors.surfaceMuted,
            borderRadius: mobileRadius.md
          }}
        >
          <Text style={{ ...mobileTypography.body, fontWeight: "700" }}>
            {tooltip.name}
          </Text>
          <Text style={{ ...mobileTypography.meta, color: mobileColors.textSecondary }}>
            {tooltip.month} · {tooltip.qty.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg
          </Text>
        </View>
      ) : (
        <Text
          style={{
            ...mobileTypography.meta,
            color: mobileColors.textSecondary,
            marginTop: mobileSpacing.xs
          }}
        >
          —
        </Text>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: "row",
          gap: mobileSpacing.md,
          marginTop: mobileSpacing.md,
          paddingRight: mobileSpacing.lg
        }}
      >
        {chart.series.map((s) => (
          <View key={s.feedTypeId} style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: s.color,
                marginRight: 6
              }}
            />
            <Text style={{ ...mobileTypography.meta, color: mobileColors.textPrimary }}>
              {s.name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
