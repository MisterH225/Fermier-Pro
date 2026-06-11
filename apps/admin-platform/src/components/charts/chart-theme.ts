export const CHART_BLUE = "#2563EB";
export const CHART_BLUE_LIGHT = "#3B82F6";
export const CHART_LIME = "#84CC16";
export const CHART_DARK = "#1E293B";
export const CHART_TRACK = "#E8EDF2";
export const CHART_MUTED = "#94A3B8";

export const CHART_PALETTE = [
  CHART_BLUE,
  CHART_LIME,
  CHART_DARK,
  "#6366F1",
  "#0EA5E9",
  "#F59E0B"
] as const;

export const chartTooltipStyle = {
  borderRadius: "9999px",
  border: "none",
  background: CHART_DARK,
  color: "#fff",
  padding: "8px 14px",
  fontSize: "12px",
  fontWeight: 600,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)"
} as const;

export const chartAxisTick = { fontSize: 11, fill: CHART_MUTED } as const;

export const chartBarRadius: [number, number, number, number] = [999, 999, 999, 999];
