"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, PawPrint, Receipt, Users } from "lucide-react";
import { fetchPlatformOverview, type OverviewDto } from "@/lib/api";
import { computeSignupDelta, OverviewStatCard } from "@/components/dashboard/OverviewStatCard";
import { OverviewWelcomeBanner } from "@/components/dashboard/OverviewWelcomeBanner";
import { OverviewActivityFeed } from "@/components/dashboard/OverviewActivityFeed";
import { OverviewSidebarPanel } from "@/components/dashboard/OverviewSidebarPanel";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { PigPriceIndexSection } from "@/components/market/PigPriceIndexSection";
import { useAdminToken } from "@/lib/useAdminToken";
import { ChartCard } from "@/components/charts/ChartCard";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { SemiGaugeChart } from "@/components/charts/SemiGaugeChart";
import { HorizontalRankChart } from "@/components/charts/HorizontalRankChart";
import { CHART_PALETTE } from "@/components/charts/chart-theme";

export function OverviewPageClient() {
  const t = useTranslations("overview");
  const { token, ready } = useAdminToken();
  const [data, setData] = useState<OverviewDto | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchPlatformOverview(token).then(setData);
  }, [token]);

  if (!ready || !data) {
    return <PageSkeleton />;
  }

  const signupDelta = computeSignupDelta(data.charts.signups30d);
  const profileTotal = data.charts.profileDistribution.reduce((s, p) => s + p.count, 0);

  const signupChartData = data.charts.signups30d.map((row) => ({
    date: row.day.slice(5),
    signups: row.count
  }));

  const profileGaugeData = data.charts.profileDistribution.map((p, i) => ({
    name: p.profile,
    value: p.count,
    color: CHART_PALETTE[i % CHART_PALETTE.length]
  }));

  const topCountries = [...data.charts.farmsByCountry]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({
      label: c.country || t("countries.unknown"),
      value: c.count
    }));

  return (
    <AdminPageShell wide>
      <div className="space-y-6">
        <OverviewWelcomeBanner />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewStatCard
            compact
            label={t("kpis.farms")}
            value={data.kpis.activeFarms}
            accent="#3B82F6"
            icon={Building2}
          />
          <OverviewStatCard
            compact
            label={t("kpis.animals")}
            value={data.kpis.activeAnimals}
            accent="#6366F1"
            icon={PawPrint}
          />
          <OverviewStatCard
            featured
            label={t("kpis.users")}
            value={data.kpis.totalUsers}
            delta={signupDelta}
            deltaLabel={t("deltaPeriod")}
            icon={Users}
          />
          <OverviewStatCard
            compact
            label={t("kpis.transactions")}
            value={data.kpis.monthTransactions}
            accent="#0EA5E9"
            icon={Receipt}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <div className="space-y-5">
            <ChartCard
              title={t("charts.signups")}
              badge={t("charts.period30d")}
              contentClassName="pb-6"
            >
              <AreaTrendChart data={signupChartData} dataKey="signups" height={300} showGrid />
            </ChartCard>

            <div className="grid gap-5 md:grid-cols-2">
              <ChartCard title={t("charts.profiles")} contentClassName="pb-6">
                <SemiGaugeChart
                  data={profileGaugeData}
                  centerValue={profileTotal}
                  centerLabel={t("charts.totalProfiles")}
                  height={200}
                />
              </ChartCard>

              <ChartCard title={t("countries.title")} contentClassName="pb-6">
                {topCountries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("countries.empty")}</p>
                ) : (
                  <HorizontalRankChart data={topCountries} />
                )}
              </ChartCard>
            </div>

            <OverviewActivityFeed data={data.recentActivity} />
          </div>

          <div className="space-y-5">
            <OverviewSidebarPanel kpis={data.kpis} />
            {token ? <PigPriceIndexSection token={token} compact /> : null}
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
