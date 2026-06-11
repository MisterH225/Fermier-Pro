"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from "recharts";
import { CHART_PALETTE, chartAxisTick } from "./chart-theme";
import { GlassChartTooltip } from "./GlassChartTooltip";

type Series = {
  key: string;
  color?: string;
  label?: string;
};

type Props = {
  data: Array<Record<string, string | number | null | boolean>>;
  series: Series[];
  height?: number;
  showLegend?: boolean;
};

export function LineTrendChart({
  data,
  series,
  height = 320,
  showLegend = true
}: Props) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="date" tick={chartAxisTick} />
          <YAxis tick={chartAxisTick} width={48} />
          <Tooltip content={<GlassChartTooltip />} />
          {showLegend ? (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
          ) : null}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
