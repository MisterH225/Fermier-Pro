"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { apiFetch, type OverviewDto } from "@/lib/api";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#FF8C00", "#1565C0", "#2E7D32", "#6A1B9A", "#E53935"];

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
    return <p className="text-muted-foreground">…</p>;
  }

  const kpis = [
    { label: t("kpis.farms"), value: data.kpis.activeFarms, color: "#FFF3E0", accent: "#FF8C00" },
    { label: t("kpis.users"), value: data.kpis.totalUsers, color: "#E3F2FD", accent: "#1565C0" },
    {
      label: t("kpis.vetsVerified"),
      value: data.kpis.verifiedVets,
      color: "#E8F5E9",
      accent: "#2E7D32"
    },
    {
      label: t("kpis.vetsPending"),
      value: data.kpis.pendingVets,
      color: "#FCE4EC",
      accent: "#C2185B"
    },
    {
      label: t("kpis.animals"),
      value: data.kpis.activeAnimals,
      color: "#EDE7F6",
      accent: "#6A1B9A"
    },
    {
      label: t("kpis.diseases"),
      value: data.kpis.activeDiseases,
      color: "#FFEBEE",
      accent: "#E53935"
    },
    {
      label: t("kpis.transactions"),
      value: data.kpis.monthTransactions,
      color: "#E0F7FA",
      accent: "#00838F"
    },
    {
      label: t("kpis.countries"),
      value: data.kpis.countriesCovered,
      color: "#FFF8E1",
      accent: "#F57F17"
    }
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            accent={k.accent}
            background={k.color}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("charts.signups")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.signups30d}>
                <XAxis dataKey="day" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1B3B2E" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("charts.profiles")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.profileDistribution}
                  dataKey="count"
                  nameKey="profile"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {data.charts.profileDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {data.recentActivity.vetRequests.map((v) => (
              <li key={v.id}>
                🩺 Demande vétérinaire — {v.name} ({v.country})
              </li>
            ))}
            {data.recentActivity.signups.map((u) => (
              <li key={u.id}>
                👤 Inscription — {u.name}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
