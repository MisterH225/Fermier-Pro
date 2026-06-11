export const KPI_VARIANTS = {
  blue: { accent: "#2563EB", background: "rgba(37, 99, 235, 0.08)" },
  indigo: { accent: "#6366F1", background: "rgba(99, 102, 241, 0.08)" },
  sky: { accent: "#0EA5E9", background: "rgba(14, 165, 233, 0.08)" },
  danger: { accent: "#EF4444", background: "rgba(239, 68, 68, 0.08)" },
  warning: { accent: "#F59E0B", background: "rgba(245, 158, 11, 0.08)" },
  purple: { accent: "#8B5CF6", background: "rgba(139, 92, 246, 0.08)" }
} as const;

export type KpiVariant = keyof typeof KPI_VARIANTS;

export const CHART_COLORS = ["#2563EB", "#84CC16", "#1E293B", "#6366F1", "#0EA5E9", "#F59E0B"];

export const selectClass =
  "flex h-10 w-full max-w-md rounded-2xl border border-white/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

export const glassInputClass =
  "rounded-2xl border-white/60 bg-white/50 backdrop-blur-sm focus-visible:ring-primary";
