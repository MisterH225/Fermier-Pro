"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Download, Filter, Sprout, Tractor, Users } from "lucide-react";
import { fetchPlatformOverview, type OverviewDto } from "@/lib/api";
import { computeSignupDelta, OverviewStatCard } from "@/components/dashboard/OverviewStatCard";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { PigPriceIndexSection } from "@/components/market/PigPriceIndexSection";
import { useAdminToken } from "@/lib/useAdminToken";

const PROFILE_COLORS = ["#2563EB", "#3B82F6", "#60A5FA", "#818CF8", "#6366F1"];
const CHART_BLUE = "#2563EB";

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
    { label: t("kpis.transactions"), value: data.kpis.monthTransactions, accent: "#0EA5E9" }
  ];

  const topCountries = [...data.charts.farmsByCountry]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const countryMax = topCountries[0]?.count ?? 1;

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
          <OverviewStatCard key={k.label} label={k.label} value={k.value} accent={k.accent} />
        ))}
      </div>

      {token ? (
        <div className="max-w-sm">
          <PigPriceIndexSection token={token} compact />
        </div>
      ) : null}

      <div className="grid lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>{t("charts.signups")}</CardTitle>
            <span className="text-xs font-medium text-muted-foreground rounded-full bg-white/60 px-3 py-1">
              {t("charts.period30d")}
            </span>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.signups30d} barSize={12}>
                <XAxis dataKey="day" hide />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.6)",
                    background: "rgba(255,255,255,0.9)",
                    backdropFilter: "blur(8px)"
                  }}
                />
                <Bar dataKey="count" fill={CHART_BLUE} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>{t("charts.profiles")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 h-72">
            <div className="relative w-44 h-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.profileDistribution}
                    dataKey="count"
                    nameKey="profile"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {data.charts.profileDistribution.map((_, i) => (
                      <Cell key={i} fill={PROFILE_COLORS[i % PROFILE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-primary tabular-nums">
                  {profileTotal}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("charts.totalProfiles")}
                </span>
              </div>
            </div>
            <ul className="flex-1 space-y-2.5 text-sm w-full">
              {data.charts.profileDistribution.map((p, i) => (
                <li key={p.profile} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PROFILE_COLORS[i % PROFILE_COLORS.length] }}
                    />
                    <span className="truncate capitalize">{p.profile}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{p.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Tractor className="size-4 text-primary" />
              {t("countries.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("countries.empty")}</p>
            ) : (
              topCountries.map((c) => (
                <div key={c.country} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.country || t("countries.unknown")}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {Math.round((c.count / countryMax) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400"
                      style={{ width: `${Math.max(8, (c.count / countryMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

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
