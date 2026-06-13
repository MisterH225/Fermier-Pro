"use client";

import { CHART_PALETTE } from "./chart-theme";

type Item = {
  name: string;
  value: number;
  color?: string;
};

type Props = {
  items: Item[];
  formatValue?: (value: number) => string;
  showPercent?: boolean;
};

export function ChartLegend({ items, formatValue, showPercent = true }: Props) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <ul className="space-y-2.5 w-full">
      {items.map((item, i) => {
        const color = item.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
        const pct = Math.round((item.value / total) * 100);
        return (
          <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="truncate capitalize text-foreground/90">{item.name}</span>
            </span>
            <span className="font-bold tabular-nums text-foreground shrink-0">
              {formatValue ? formatValue(item.value) : item.value}
              {showPercent ? (
                <span className="text-muted-foreground font-medium ml-1.5 text-xs">
                  {pct}%
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
