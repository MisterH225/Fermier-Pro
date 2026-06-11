import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KPI_VARIANTS, type KpiVariant } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number | string;
  variant?: KpiVariant;
  accent?: string;
  background?: string;
  icon?: React.ReactNode;
  delta?: number | null;
  deltaLabel?: string;
};

export function KpiCard({
  label,
  value,
  variant = "blue",
  accent,
  background,
  icon,
  delta,
  deltaLabel
}: Props) {
  const palette = KPI_VARIANTS[variant];
  const accentColor = accent ?? palette.accent;
  const bgColor = background ?? palette.background;
  const positive = delta != null && delta >= 0;

  return (
    <Card className="border-white/60 overflow-hidden" style={{ backgroundColor: bgColor }}>
      <CardContent className="p-5 pt-5 min-h-[148px] flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground leading-snug">{label}</p>
          {icon ? (
            <span
              className="size-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              {icon}
            </span>
          ) : null}
        </div>
        <div className="mt-3">
          <p
            className="text-3xl font-extrabold tabular-nums tracking-tight"
            style={{ color: accentColor }}
          >
            {value}
          </p>
          {delta != null ? (
            <div className="flex items-center gap-2 text-xs mt-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                  positive
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {positive ? "+" : ""}
                {delta}%
              </span>
              {deltaLabel ? (
                <span className="text-muted-foreground">{deltaLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
