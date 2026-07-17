"use client";

import { CHART_PALETTE } from "./chart-theme";

export type ProportionSegment = {
  name: string;
  value: number;
  color?: string;
};

type Props = {
  data: ProportionSegment[];
  height?: number;
};

export function ProportionBar({ data, height = 28 }: Props) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div className="space-y-3">
      <div
        className="flex w-full overflow-hidden rounded-full border border-white/60 bg-white/70"
        style={{ height }}
      >
        {filtered.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          return (
            <div
              key={seg.name}
              title={`${seg.name}: ${Math.round(pct)}%`}
              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${Math.max(pct, 2)}%`,
                backgroundColor:
                  seg.color ?? CHART_PALETTE[i % CHART_PALETTE.length]
              }}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {filtered.map((seg, i) => {
          const pct = Math.round((seg.value / total) * 100);
          const color = seg.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
          return (
            <li key={seg.name} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground capitalize">{seg.name}</span>
              <span className="font-bold tabular-nums">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
