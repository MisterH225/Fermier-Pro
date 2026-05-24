"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { Link } from "@/i18n/navigation";
import { apiFetch, type UserDetailDto } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TABS = [
  "profil",
  "cheptel",
  "finance",
  "sante",
  "gestation",
  "activite"
] as const;

type TabId = (typeof TABS)[number];

const PIE_COLORS = ["#FF8C00", "#1565C0", "#2E7D32", "#6A1B9A", "#E53935"];

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  }).format(n);
}

function formatPct(n: number) {
  return `${(n * 100).toFixed(1)} %`;
}

export default function UserDetailPage() {
  const t = useTranslations("users.detail");
  const tUsers = useTranslations("users");
  const params = useParams();
  const id = params.id as string;
  const { token, ready } = useAdminToken();
  const [data, setData] = useState<UserDetailDto | null>(null);
  const [tab, setTab] = useState<TabId>("profil");

  useEffect(() => {
    if (!token) return;
    apiFetch<UserDetailDto>(`/admin/users/${id}`, token).then(setData);
  }, [token, id]);

  if (!ready || !data) {
    return <p className="text-muted-foreground">…</p>;
  }

  const { user, farms, livestockSummary, financeSummary, healthSummary, gestationSummary } =
    data;

  const profileLabel = (type: string) => {
    if (
      type === "producer" ||
      type === "technician" ||
      type === "veterinarian" ||
      type === "buyer"
    ) {
      return tUsers(`profiles.${type}`);
    }
    return type;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.fullName ?? user.email ?? user.id}
        description={user.email ?? undefined}
        action={
          <Button variant="outline" asChild>
            <Link href="/utilisateurs">← {t("back")}</Link>
          </Button>
        }
      />

      <FilterPills
        items={TABS}
        value={tab}
        onChange={setTab}
        label={(id) => t(`tabs.${id}`)}
        size="default"
      />

      {tab === "profil" ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("sections.identity")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">{t("fields.phone")}:</span>{" "}
                {user.phone ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("fields.location")}:</span>{" "}
                {user.homeLocationLabel ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("fields.joined")}:</span>{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {data.profiles.map((p) => (
                  <Badge key={p.id} variant="secondary">
                    {profileLabel(p.type)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("sections.farms")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {farms.length === 0 ? (
                <p className="text-muted-foreground">{t("noFarm")}</p>
              ) : (
                farms.map((f) => (
                  <div key={f.id} className="border rounded-xl p-4">
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-muted-foreground text-xs mt-1">{f.address ?? "—"}</p>
                    <p className="text-xs mt-2">
                      {f.activeAnimals} {t("fields.animals")} · {f.healthRecords}{" "}
                      {t("fields.healthRecords")}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {data.memberships.length > 0 ? (
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("sections.collaborations")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-2">
                  {data.memberships.map((m) => (
                    <li key={m.id}>
                      <Badge variant="outline">{m.farm.name}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "cheptel" ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <KpiCard
            label={t("livestock.total")}
            value={livestockSummary.totalActive}
            accent="#FF8C00"
            background="#FFF3E0"
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("livestock.byCategory")}</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {livestockSummary.byCategory.length === 0 ? (
                <p className="text-muted-foreground text-sm">—</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={livestockSummary.byCategory.map((c) => ({
                        name: c.category,
                        value: c.count
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {livestockSummary.byCategory.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "finance" ? (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <KpiCard
              label={t("finance.revenues")}
              value={formatMoney(financeSummary.revenues3m)}
              accent="#2E7D32"
              background="#E8F5E9"
            />
            <KpiCard
              label={t("finance.expenses")}
              value={formatMoney(financeSummary.expenses3m)}
              accent="#E53935"
              background="#FFEBEE"
            />
            <KpiCard
              label={t("finance.margin")}
              value={formatMoney(financeSummary.netMargin3m)}
              accent="#1565C0"
              background="#E3F2FD"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("finance.note")}</p>
        </div>
      ) : null}

      {tab === "sante" ? (
        <div className="grid md:grid-cols-3 gap-4">
          <KpiCard
            label={t("health.activeDiseases")}
            value={String(healthSummary.activeDiseases)}
            accent="#E53935"
            background="#FFEBEE"
          />
          <KpiCard
            label={t("health.mortality")}
            value={formatPct(healthSummary.mortalityRate30d)}
            accent="#6A1B9A"
            background="#F3E5F5"
          />
          <KpiCard
            label={t("health.overdueVaccines")}
            value={String(healthSummary.overdueVaccines)}
            accent="#F57F17"
            background="#FFF8E1"
          />
        </div>
      ) : null}

      {tab === "gestation" ? (
        <div className="grid md:grid-cols-2 gap-4">
          <KpiCard
            label={t("gestation.active")}
            value={String(gestationSummary.active)}
            accent="#C2185B"
            background="#FCE4EC"
          />
          <KpiCard
            label={t("gestation.upcoming")}
            value={String(gestationSummary.upcomingFarrowings)}
            accent="#00838F"
            background="#E0F7FA"
          />
        </div>
      ) : null}

      {tab === "activite" ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            <p>{t("activity.placeholder")}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
