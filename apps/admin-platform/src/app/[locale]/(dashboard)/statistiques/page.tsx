"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Skull, Users } from "lucide-react";
import { fetchAdminStats, type StatsDto } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { PigPriceIndexSection } from "@/components/market/PigPriceIndexSection";
import { HybridPigPriceAdminSection } from "@/components/market/HybridPigPriceAdminSection";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { HorizontalRankChart } from "@/components/charts/HorizontalRankChart";

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
    fetchAdminStats(token, period)
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, period]);

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  const diseaseRank = (data?.topDiseases ?? []).map((d) => ({
    label: d.label,
    value: d.count
  }));

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
              variant="blue"
              icon={<Users className="size-4" />}
            />
            <KpiCard
              label={t("kpis.activeAnimals")}
              value={data.activeAnimals}
              variant="warning"
              icon={<Activity className="size-4" />}
            />
            <KpiCard
              label={t("kpis.mortality")}
              value={data.mortalityHeadcount}
              variant="danger"
              icon={<Skull className="size-4" />}
            />
          </div>

          <ChartCard title={t("topDiseases")} contentClassName="pb-6">
            <HorizontalRankChart data={diseaseRank} />
          </ChartCard>

          {token ? <PigPriceIndexSection token={token} /> : null}
          {token ? <HybridPigPriceAdminSection token={token} /> : null}
        </>
      )}
    </div>
  );
}
