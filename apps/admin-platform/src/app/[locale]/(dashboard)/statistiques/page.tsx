"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch, type StatsDto } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { PigPriceIndexSection } from "@/components/market/PigPriceIndexSection";
import { HybridPigPriceAdminSection } from "@/components/market/HybridPigPriceAdminSection";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PERIODS = ["month", "quarter", "year"] as const;

export default function StatistiquesPage() {
  const t = useTranslations("stats");
  const { token, ready } = useAdminToken();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("month");
  const [data, setData] = useState<StatsDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<StatsDto>(`/admin/stats?period=${period}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, period]);

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        action={
          <FilterPills
            items={PERIODS}
            value={period}
            onChange={setPeriod}
            label={(p) => t(`periods.${p}`)}
          />
        }
      />

      {loading || !data ? (
        <p className="text-muted-foreground">…</p>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <KpiCard
              label={t("kpis.newUsers")}
              value={data.newUsers}
              accent="#1565C0"
              background="#E3F2FD"
            />
            <KpiCard
              label={t("kpis.activeAnimals")}
              value={data.activeAnimals}
              accent="#FF8C00"
              background="#FFF3E0"
            />
            <KpiCard
              label={t("kpis.mortality")}
              value={data.mortalityHeadcount}
              accent="#E53935"
              background="#FFEBEE"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("topDiseases")}</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              {data.topDiseases.length === 0 ? (
                <p className="text-muted-foreground text-sm">—</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topDiseases} layout="vertical" margin={{ left: 24 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {token ? <PigPriceIndexSection token={token} /> : null}
          {token ? <HybridPigPriceAdminSection token={token} /> : null}
        </>
      )}
    </div>
  );
}
