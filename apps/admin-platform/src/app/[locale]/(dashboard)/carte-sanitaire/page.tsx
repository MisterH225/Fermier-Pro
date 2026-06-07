"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { AlertCreationModal } from "@/components/map/AlertCreationModal";
import { apiFetch, type HealthMapDto, type SanitaryAlertRow } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const HealthMapbox = dynamic(
  () => import("@/components/map/HealthMapbox").then((m) => m.HealthMapbox),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 rounded-xl border bg-muted animate-pulse" />
    )
  }
);

const PERIODS = ["7", "30", "90", "365"] as const;

type PeriodKey = (typeof PERIODS)[number];

function periodToDays(key: PeriodKey): 7 | 30 | 90 | 365 {
  return Number(key) as 7 | 30 | 90 | 365;
}

function heatColor(active: number, max: number) {
  if (max <= 0 || active <= 0) return "bg-rose-50";
  const ratio = active / max;
  if (ratio > 0.75) return "bg-red-700 text-white";
  if (ratio > 0.5) return "bg-red-500 text-white";
  if (ratio > 0.25) return "bg-red-300";
  return "bg-rose-100";
}

const ALERT_LEVEL_CLASS: Record<string, string> = {
  info: "bg-blue-100 text-blue-900 border-blue-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  critical: "bg-red-100 text-red-900 border-red-200"
};

export default function CarteSanitairePage() {
  const t = useTranslations("map");
  const { token, ready } = useAdminToken();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30");
  const periodDays = periodToDays(periodKey);
  const [data, setData] = useState<HealthMapDto | null>(null);
  const [alerts, setAlerts] = useState<SanitaryAlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiFetch<HealthMapDto>(`/admin/health-map?periodDays=${periodDays}`, token),
      apiFetch<SanitaryAlertRow[]>("/admin/sanitary-alerts", token)
    ])
      .then(([map, list]) => {
        setData(map);
        setAlerts(list);
      })
      .finally(() => setLoading(false));
  }, [token, periodDays]);

  useEffect(() => {
    load();
  }, [load]);

  const maxActive = useMemo(
    () => Math.max(0, ...(data?.regions.map((r) => r.activeCases) ?? [0])),
    [data]
  );

  if (!ready || !token) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              items={PERIODS}
              value={periodKey}
              onChange={setPeriodKey}
              label={(d) => t(`periods.${d}` as "periods.30")}
            />
            <AlertCreationModal accessToken={token} onCreated={load} />
          </div>
        }
      />

      {loading || !data ? (
        <div className="h-[420px] rounded-xl border bg-muted animate-pulse" />
      ) : (
        <HealthMapbox points={data.points} className="h-[420px] w-full rounded-xl border" />
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("regions")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.regions.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {data.regions
                  .sort((a, b) => b.activeCases - a.activeCases)
                  .map((r) => (
                    <div
                      key={r.country}
                      className={cn(
                        "rounded-xl p-4 border transition",
                        heatColor(r.activeCases, maxActive)
                      )}
                    >
                      <p className="font-bold">{r.country}</p>
                      <p className="text-sm mt-2 opacity-90">
                        {t("activeCases", { count: r.activeCases })}
                      </p>
                      <p className="text-xs mt-1 opacity-80">
                        {t("farms", { count: r.farmCount })} ·{" "}
                        {t("totalCases", { count: r.totalCases })}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("alertsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noAlerts")}</p>
            ) : (
              <ul className="space-y-3 text-sm max-h-80 overflow-y-auto">
                {alerts.map((a) => (
                  <li key={a.id} className="border rounded-lg p-3 space-y-2">
                    <p className="font-semibold">{a.zoneName}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", ALERT_LEVEL_CLASS[a.level] ?? "")}
                      >
                        {a.level}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {a.alertType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
