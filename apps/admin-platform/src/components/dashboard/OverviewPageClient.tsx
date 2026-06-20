"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Filter, Sprout, Users } from "lucide-react";
import { fetchPlatformOverview, type OverviewDto } from "@/lib/api";
import { computeSignupDelta, OverviewStatCard } from "@/components/dashboard/OverviewStatCard";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { PigPriceIndexSection } from "@/components/market/PigPriceIndexSection";
import { useAdminToken } from "@/lib/useAdminToken";
import { ChartCard } from "@/components/charts/ChartCard";
import { TrackBarChart } from "@/components/charts/TrackBarChart";
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

  const secondaryKpis = [
    { label: t("kpis.farms"), value: data.kpis.activeFarms, accent: "#3B82F6" },
    { label: t("kpis.animals"), value: data.kpis.activeAnimals, accent: "#6366F1" },
    {
      label: t("kpis.diseases"),
      value: data.kpis.activeDiseases,
      accent: "#DC2626",
      href: "/carte-sanitaire" as const
    },
    { label: t("kpis.transactions"), value: data.kpis.monthTransactions, accent: "#0EA5E9" }
  ];

  const signupChartData = data.charts.signups30d.map((row) => ({
    label: row.day.slice(5),
    value: row.count
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/statistiques">
              <Download className="size-4" />
              {t("actions.export")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/parametres">
              <Filter className="size-4" />
              {t("actions.filter")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OverviewStatCard
          featured
          label={t("kpis.users")}
          value={data.kpis.totalUsers}
          delta={signupDelta}
          deltaLabel={t("deltaPeriod")}
        />
        {secondaryKpis.map((k) => (
          <OverviewStatCard
            key={k.label}
            label={k.label}
            value={k.value}
            accent={k.accent}
            href={"href" in k ? k.href : undefined}
          />
        ))}
      </div>

      {token ? (
        <div className="max-w-sm">
          <PigPriceIndexSection token={token} compact />
        </div>
      ) : null}

      <div className="grid lg:grid-cols-5 gap-5">
        <ChartCard
          className="lg:col-span-3"
          title={t("charts.signups")}
          badge={t("charts.period30d")}
          contentClassName="pb-6"
        >
          <TrackBarChart data={signupChartData} height={288} />
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title={t("charts.profiles")}
          contentClassName="pb-6"
        >
          <SemiGaugeChart
            data={profileGaugeData}
            centerValue={profileTotal}
            centerLabel={t("charts.totalProfiles")}
            height={200}
          />
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title={t("countries.title")} contentClassName="pb-6">
          {topCountries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("countries.empty")}</p>
          ) : (
            <HorizontalRankChart data={topCountries} />
          )}
        </ChartCard>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {t("activity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.recentActivity.vetRequests.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-white/50 transition"
                >
                  <span className="mt-0.5 size-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Sprout className="size-4 text-amber-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground leading-snug">
                      {t("activityItems.vetRequest", { name: v.name, country: v.country })}
                    </p>
                  </div>
                </li>
              ))}
              {data.recentActivity.signups.map((u) => (
                <li
                  key={u.id}
                  className="flex items-start gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-white/50 transition"
                >
                  <span className="mt-0.5 size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="size-4 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground leading-snug">
                      {t("activityItems.signup", { name: u.name })}
                    </p>
                  </div>
                </li>
              ))}
              {data.recentActivity.vetRequests.length === 0 &&
              data.recentActivity.signups.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">{t("activityEmpty")}</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
