"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Baby, HeartPulse, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { fetchUserDetail, type UserDetailDto } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { UserAvatar } from "@/components/users/UserAvatar";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { SemiGaugeChart } from "@/components/charts/SemiGaugeChart";
import { CHART_PALETTE } from "@/components/charts/chart-theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number) {
  return `${(n * 100).toFixed(1)} %`;
}

function DetailSection({
  title,
  children,
  className
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-lg font-bold text-foreground border-b border-white/60 pb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function UserDetailPage() {
  const t = useTranslations("users.detail");
  const tUsers = useTranslations("users");
  const params = useParams();
  const id = params.id as string;
  const { token, ready } = useAdminToken();
  const [data, setData] = useState<UserDetailDto | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchUserDetail(token, id).then(setData);
  }, [token, id]);

  if (!ready || !data) {
    return <PageSkeleton className="max-w-5xl" />;
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
    <div className="space-y-10 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <UserAvatar
            name={user.fullName}
            email={user.email}
            avatarUrl={user.avatarUrl}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
              {user.fullName ?? user.email ?? user.id}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{user.email ?? "—"}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge
                variant={user.isActive ? "success" : "outline"}
                className={cn(!user.isActive && "bg-muted text-muted-foreground")}
              >
                {user.isActive ? tUsers("status.active") : tUsers("status.inactive")}
              </Badge>
              {data.profiles.map((p) => (
                <Badge key={p.id} variant="secondary">
                  {profileLabel(p.type)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button variant="outline" className="shrink-0" asChild>
          <Link href="/utilisateurs">← {t("back")}</Link>
        </Button>
      </div>

      <DetailSection title={t("tabs.profil")}>
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
                  <div key={f.id} className="border border-white/60 rounded-2xl p-4 bg-white/40 backdrop-blur-sm">
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-muted-foreground text-xs mt-1">{f.address ?? "—"}</p>
                    <p className="text-xs mt-2 text-muted-foreground">
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
                      <Badge variant="outline" className="rounded-lg">
                        {m.farm.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </DetailSection>

      <DetailSection title={t("tabs.cheptel")}>
        <div className="grid lg:grid-cols-3 gap-4">
          <KpiCard
            label={t("livestock.total")}
            value={livestockSummary.totalActive}
            variant="warning"
            icon={<PiggyBank className="size-4" />}
          />
          <ChartCard
            className="lg:col-span-2"
            title={t("livestock.byCategory")}
            contentClassName="pb-4"
          >
            {livestockSummary.byCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <SemiGaugeChart
                data={livestockSummary.byCategory.map((c, i) => ({
                  name: c.category,
                  value: c.count,
                  color: CHART_PALETTE[i % CHART_PALETTE.length]
                }))}
                centerValue={livestockSummary.totalActive}
                centerLabel={t("livestock.total")}
                height={200}
              />
            )}
          </ChartCard>
        </div>
      </DetailSection>

      <DetailSection title={t("tabs.finance")}>
        <div className="grid md:grid-cols-3 gap-4">
          <KpiCard
            label={t("finance.revenues")}
            value={formatMoney(financeSummary.revenues3m)}
            variant="blue"
            icon={<TrendingUp className="size-4" />}
          />
          <KpiCard
            label={t("finance.expenses")}
            value={formatMoney(financeSummary.expenses3m)}
            variant="danger"
            icon={<TrendingDown className="size-4" />}
          />
          <KpiCard
            label={t("finance.margin")}
            value={formatMoney(financeSummary.netMargin3m)}
            variant="indigo"
            icon={<Wallet className="size-4" />}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("finance.note")}</p>
      </DetailSection>

      <DetailSection title={t("tabs.sante")}>
        <div className="grid md:grid-cols-3 gap-4">
          <KpiCard
            label={t("health.activeDiseases")}
            value={String(healthSummary.activeDiseases)}
            variant="danger"
            icon={<HeartPulse className="size-4" />}
          />
          <KpiCard
            label={t("health.mortality")}
            value={formatPct(healthSummary.mortalityRate30d)}
            variant="purple"
            icon={<TrendingDown className="size-4" />}
          />
          <KpiCard
            label={t("health.overdueVaccines")}
            value={String(healthSummary.overdueVaccines)}
            variant="warning"
            icon={<HeartPulse className="size-4" />}
          />
        </div>
      </DetailSection>

      <DetailSection title={t("tabs.gestation")}>
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
          <KpiCard
            label={t("gestation.active")}
            value={String(gestationSummary.active)}
            variant="danger"
            icon={<Baby className="size-4" />}
          />
          <KpiCard
            label={t("gestation.upcoming")}
            value={String(gestationSummary.upcomingFarrowings)}
            variant="sky"
            icon={<Baby className="size-4" />}
          />
        </div>
      </DetailSection>
    </div>
  );
}
