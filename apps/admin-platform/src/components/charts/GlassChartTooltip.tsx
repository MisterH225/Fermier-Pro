"use client";

import type { TooltipProps } from "recharts";
import { chartTooltipStyle } from "./chart-theme";

type Props = TooltipProps<number, string> & {
  valueLabel?: string;
  formatValue?: (value: number) => string;
};

export function GlassChartTooltip({
  active,
  payload,
  label,
  valueLabel,
  formatValue
}: Props) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const value =
    typeof raw === "number"
      ? formatValue
        ? formatValue(raw)
        : raw.toLocaleString("fr-FR")
      : String(raw ?? "—");

  return (
    <div style={chartTooltipStyle}>
      {label ? <span className="opacity-80 mr-1.5">{label}</span> : null}
      {valueLabel ? `${valueLabel}: ` : ""}
      {value}
    </div>
  );
}
