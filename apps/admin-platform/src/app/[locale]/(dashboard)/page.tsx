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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { apiFetch, type OverviewDto } from "@/lib/api";
import { computeSignupDelta, OverviewStatCard } from "@/components/dashboard/OverviewStatCard";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

const PROFILE_COLORS = ["#1B3B2E", "#FF8C00", "#8B9A5B", "#1565C0", "#6A1B9A"];

export default function OverviewPage() {
  const t = useTranslations("overview");
  const [data, setData] = useState<OverviewDto | null>(null);

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data: s }) => {
        const token = s.session?.access_token;
        if (!token) return;
        return apiFetch<OverviewDto>("/admin/platform/overview", token);
      })
      .then((d) => d && setData(d));
  }, []);

  if (!data) {
    return <PageSkeleton />;
  }

  const signupDelta = computeSignupDelta(data.charts.signups30d);
  const profileTotal = data.charts.profileDistribution.reduce((s, p) => s + p.count, 0);

  const secondaryKpis = [
    {
      label: t("kpis.farms"),
      value: data.kpis.activeFarms,
      accent: "#FF8C00"
    },
    {
      label: t("kpis.animals"),
      value: data.kpis.activeAnimals,
      accent: "#6A1B9A"
    },
    {
      label: t("kpis.transactions"),
      value: data.kpis.monthTransactions,
      accent: "#00838F"
    }
  ];

  const topCountries = [...data.charts.farmsByCountry]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const countryMax = topCountries[0]?.count ?? 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link href="/statistiques">
              <Download className="size-4" />
              {t("actions.export")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link href="/parametres">
              <Filter className="size-4" />
              {t("actions.filter")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <OverviewStatCard
            featured
            label={t("kpis.users")}
            value={data.kpis.totalUsers}
            delta={signupDelta}
            deltaLabel={t("deltaPeriod")}
          />
        </div>
        {secondaryKpis.map((k) => (
          <OverviewStatCard key={k.label} label={k.label} value={k.value} accent={k.accent} />
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-bold">{t("charts.signups")}</CardTitle>
            <span className="text-xs text-muted-foreground">{t("charts.period30d")}</span>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.signups30d} barSize={14}>
                <XAxis dataKey="day" hide />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1B3B2E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">{t("charts.profiles")}</CardTitle>
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
                    paddingAngle={2}
                  >
                    {data.charts.profileDistribution.map((_, i) => (
                      <Cell key={i} fill={PROFILE_COLORS[i % PROFILE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-brand tabular-nums">{profileTotal}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("charts.totalProfiles")}
                </span>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-sm w-full">
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Tractor className="size-4 text-brand" />
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
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-brand-olive-light"
                      style={{ width: `${Math.max(8, (c.count / countryMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="size-4 text-brand" />
              {t("activity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.recentActivity.vetRequests.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted/60 transition"
                >
                  <span className="mt-0.5 size-8 rounded-full bg-brand-accent/15 flex items-center justify-center shrink-0">
                    <Sprout className="size-4 text-brand-accent" />
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
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted/60 transition"
                >
                  <span className="mt-0.5 size-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <Users className="size-4 text-brand" />
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
