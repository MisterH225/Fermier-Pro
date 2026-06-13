"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_PALETTE } from "./chart-theme";
import { ChartLegend } from "./ChartLegend";
import { GlassChartTooltip } from "./GlassChartTooltip";

export type GaugeSegment = {
  name: string;
  value: number;
  color?: string;
};

type Props = {
  data: GaugeSegment[];
  centerValue: number | string;
  centerLabel: string;
  height?: number;
};

export function SemiGaugeChart({ data, centerValue, centerLabel, height = 220 }: Props) {
  const filtered = data.filter((d) => d.value > 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-full max-w-[240px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="88%"
              startAngle={180}
              endAngle={0}
              innerRadius="58%"
              outerRadius="92%"
              paddingAngle={3}
              cornerRadius={6}
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
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center pointer-events-none">
          <span className="text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
            {centerValue}
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
