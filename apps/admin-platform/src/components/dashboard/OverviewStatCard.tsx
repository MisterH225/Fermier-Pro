import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number | string;
  delta?: number | null;
  deltaLabel?: string;
  featured?: boolean;
  accent?: string;
};

export function OverviewStatCard({
  label,
  value,
  delta,
  deltaLabel,
  featured = false,
  accent = "#1B3B2E"
}: Props) {
  const positive = delta != null && delta >= 0;

  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand-light to-brand-olive p-6 text-white shadow-lg shadow-brand/20 min-h-[160px] flex flex-col justify-between">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">{label}</p>
          <p className="text-4xl font-extrabold mt-2 tabular-nums tracking-tight">{value}</p>
        </div>
        {delta != null ? (
          <div className="relative flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold",
                positive ? "bg-white/20 text-brand-gold" : "bg-red-500/30 text-red-100"
              )}
            >
              {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {positive ? "+" : ""}
              {delta}%
            </span>
            {deltaLabel ? <span className="text-white/70 text-xs">{deltaLabel}</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm min-h-[160px] flex flex-col justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-3xl font-extrabold mt-2 tabular-nums tracking-tight" style={{ color: accent }}>
          {value}
        </p>
      </div>
      {delta != null ? (
        <div className="flex items-center gap-2 text-xs mt-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              positive ? "text-emerald-600" : "text-red-600"
            )}
          >
            {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {positive ? "+" : ""}
            {delta}%
          </span>
          {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function computeSignupDelta(series: Array<{ count: number }>): number | null {
  if (series.length < 4) return null;
  const half = Math.floor(series.length / 2);
  const recent = series.slice(half).reduce((sum, row) => sum + row.count, 0);
  const older = series.slice(0, half).reduce((sum, row) => sum + row.count, 0);
  if (older === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - older) / older) * 1000) / 10;
}
