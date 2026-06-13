"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  CHART_BLUE,
  CHART_DARK,
  CHART_TRACK,
  chartAxisTick,
  chartBarRadius
} from "./chart-theme";
import { GlassChartTooltip } from "./GlassChartTooltip";

export type TrackBarPoint = {
  label: string;
  value: number;
};

type Props = {
  data: TrackBarPoint[];
  height?: number;
  barSize?: number;
  highlightMax?: boolean;
  formatValue?: (value: number) => string;
  hideXAxis?: boolean;
};

export function TrackBarChart({
  data,
  height = 288,
  barSize = 28,
  highlightMax = true,
  formatValue,
  hideXAxis = true
}: Props) {
  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.value), 1),
    [data]
  );

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        value: d.value,
        track: maxValue
      })),
    [data, maxValue]
  );

  const peak = useMemo(
    () => (highlightMax ? Math.max(...data.map((d) => d.value)) : -1),
    [data, highlightMax]
  );

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={-barSize} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <XAxis dataKey="label" hide={hideXAxis} tick={chartAxisTick} />
          <YAxis allowDecimals={false} tick={chartAxisTick} width={32} />
          <Tooltip
            cursor={{ fill: "rgba(37, 99, 235, 0.06)", radius: 12 }}
            content={<GlassChartTooltip formatValue={formatValue} />}
          />
          <Bar dataKey="track" fill={CHART_TRACK} radius={chartBarRadius} barSize={barSize} />
          <Bar dataKey="value" radius={chartBarRadius} barSize={barSize}>
            {chartData.map((entry) => (
              <Cell
                key={entry.label}
                fill={highlightMax && entry.value === peak && peak > 0 ? CHART_BLUE : CHART_DARK}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
