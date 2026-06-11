"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CHART_BLUE, chartAxisTick } from "./chart-theme";
import { GlassChartTooltip } from "./GlassChartTooltip";

type Props = {
  data: Array<Record<string, string | number | null | boolean>>;
  dataKey: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  hideXAxis?: boolean;
};

export function AreaTrendChart({
  data,
  dataKey,
  color = CHART_BLUE,
  height = 224,
  showGrid = true,
  hideXAxis = true
}: Props) {
  const gradientId = `area-${dataKey}-${color.replace("#", "")}`;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {showGrid ? (
            <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="rgba(148,163,184,0.2)" />
          ) : null}
          <XAxis dataKey="date" hide={hideXAxis} tick={chartAxisTick} />
          <YAxis tick={chartAxisTick} width={44} />
          <Tooltip content={<GlassChartTooltip />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
