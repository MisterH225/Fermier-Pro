import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number | string;
  delta?: number | null;
  deltaLabel?: string;
  featured?: boolean;
  accent?: string;
  href?: string;
  icon?: LucideIcon;
  compact?: boolean;
};

export function OverviewStatCard({
  label,
  value,
  delta,
  deltaLabel,
  featured = false,
  accent = "#2563EB",
  href,
  icon: Icon,
  compact = false
}: Props) {
  const positive = delta != null && delta >= 0;

  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary via-brand-light to-blue-400 p-5 sm:p-6 text-white shadow-glow-blue min-h-[148px] flex flex-col justify-between">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "28px 28px"
          }}
        />
        {Icon ? (
          <Icon className="absolute right-4 top-4 size-5 text-white/50" />
        ) : null}
        <div className="relative">
          <p className="text-sm font-medium text-white/85">{label}</p>
          <p className="text-3xl sm:text-4xl font-extrabold mt-2 tabular-nums tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
        {delta != null ? (
          <div className="relative flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold",
                positive ? "bg-white/25 text-white" : "bg-red-500/30 text-red-100"
              )}
            >
              {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {positive ? "+" : ""}
              {delta}%
            </span>
            {deltaLabel ? <span className="text-white/75 text-xs">{deltaLabel}</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  const body = (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 backdrop-blur-md shadow-glass flex flex-col justify-between",
        compact ? "p-5 min-h-[148px]" : "p-5 min-h-[168px]"
      )}
    >
      {Icon ? (
        <span className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary/70">
          <Icon className="size-4" />
        </span>
      ) : null}
      <div>
        <p className="text-sm font-medium text-muted-foreground pr-10">{label}</p>
        <p
          className={cn(
            "font-extrabold mt-2 tabular-nums tracking-tight",
            compact ? "text-2xl sm:text-3xl" : "text-3xl"
          )}
          style={{ color: accent }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </div>
      {delta != null ? (
        <div className="flex items-center gap-2 text-xs mt-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              positive ? "text-primary" : "text-destructive"
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

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-95 hover:scale-[1.01]">
        {body}
      </Link>
    );
  }

  return body;
}

export function computeSignupDelta(series: Array<{ count: number }>): number | null {
  if (series.length < 4) return null;
  const half = Math.floor(series.length / 2);
  const recent = series.slice(half).reduce((sum, row) => sum + row.count, 0);
  const older = series.slice(0, half).reduce((sum, row) => sum + row.count, 0);
  if (older === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - older) / older) * 1000) / 10;
}
