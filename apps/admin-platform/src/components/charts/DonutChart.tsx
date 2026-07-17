"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_PALETTE } from "./chart-theme";
import { ChartLegend } from "./ChartLegend";
import { GlassChartTooltip } from "./GlassChartTooltip";

export type DonutSegment = {
  name: string;
  value: number;
  color?: string;
};

type Props = {
  data: DonutSegment[];
  centerValue: number | string;
  centerLabel: string;
  height?: number;
};

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 220
}: Props) {
  const filtered = data.filter((d) => d.value > 0);

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-full max-w-[220px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              cornerRadius={8}
            >
              {filtered.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<GlassChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">
            {typeof centerValue === "number"
              ? centerValue.toLocaleString()
              : centerValue}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
            {centerLabel}
          </span>
        </div>
      </div>
      <ChartLegend items={filtered} />
    </div>
  );
}
