import { Card, CardContent } from "@/components/ui/card";
import { KPI_VARIANTS, type KpiVariant } from "@/lib/ui-styles";

type Props = {
  label: string;
  value: number | string;
  variant?: KpiVariant;
  accent?: string;
  background?: string;
};

export function KpiCard({ label, value, variant = "blue", accent, background }: Props) {
  const palette = KPI_VARIANTS[variant];
  const accentColor = accent ?? palette.accent;
  const bgColor = background ?? palette.background;

  return (
    <Card className="border-white/60" style={{ backgroundColor: bgColor }}>
      <CardContent className="p-5 pt-5">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p
          className="text-3xl font-extrabold mt-1.5 tabular-nums tracking-tight"
          style={{ color: accentColor }}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
