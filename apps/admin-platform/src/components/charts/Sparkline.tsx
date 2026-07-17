"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { CHART_BLUE } from "./chart-theme";

type Props = {
  values: number[];
  color?: string;
  height?: number;
};

/** Mini courbe pour cartes KPI (sans axes). */
export function Sparkline({
  values,
  color = CHART_BLUE,
  height = 40
}: Props) {
  if (values.length < 2) return null;
  const data = values.map((value, i) => ({ i, value }));
  const id = `spark-${color.replace("#", "")}-${values.length}`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#${id})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
