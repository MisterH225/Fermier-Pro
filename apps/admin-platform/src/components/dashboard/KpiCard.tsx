import { Card, CardContent } from "@/components/ui/card";

type Props = {
  label: string;
  value: number | string;
  accent: string;
  background: string;
};

export function KpiCard({ label, value, accent, background }: Props) {
  return (
    <Card className="border-0 shadow-sm" style={{ backgroundColor: background }}>
      <CardContent className="p-4 pt-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-3xl font-extrabold mt-1 tabular-nums" style={{ color: accent }}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
