"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CHART_PALETTE, chartAxisTick } from "./chart-theme";
import { GlassChartTooltip } from "./GlassChartTooltip";

export type StackedColumnRow = {
  label: string;
  [seriesKey: string]: string | number;
};

type Props = {
  data: StackedColumnRow[];
  series: Array<{ key: string; label: string; color?: string }>;
  height?: number;
  stacked?: boolean;
};

export function StackedColumnChart({
  data,
  series,
  height = 280,
  stacked = true
}: Props) {
  if (data.length === 0 || series.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="4 6"
            vertical={false}
            stroke="rgba(148,163,184,0.2)"
          />
          <XAxis dataKey="label" tick={chartAxisTick} interval={0} />
          <YAxis allowDecimals={false} tick={chartAxisTick} width={36} />
          <Tooltip content={<GlassChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) =>
              series.find((s) => s.key === value)?.label ?? String(value)
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.key}
              stackId={stacked ? "stack" : undefined}
              fill={s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
              radius={stacked ? [4, 4, 0, 0] : [10, 10, 10, 10]}
              maxBarSize={stacked ? 40 : 24}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
