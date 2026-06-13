"use client";

import { CHART_BLUE, CHART_DARK, CHART_LIME, CHART_PALETTE } from "./chart-theme";

export type RankPoint = {
  label: string;
  value: number;
};

type Props = {
  data: RankPoint[];
  formatValue?: (value: number) => string;
  colors?: string[];
};

export function HorizontalRankChart({
  data,
  formatValue,
  colors = [CHART_BLUE, CHART_LIME, CHART_DARK, ...CHART_PALETTE.slice(3)]
}: Props) {
  const max = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((row, i) => {
        const pct = Math.round((row.value / max) * 100);
        const color = colors[i % colors.length];
        return (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground truncate">{row.label}</span>
              <span className="tabular-nums font-bold shrink-0" style={{ color }}>
                {formatValue ? formatValue(row.value) : row.value}
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/70 border border-white/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(10, pct)}%`,
                  backgroundColor: color
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
