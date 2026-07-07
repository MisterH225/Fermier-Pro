"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { AlertCreationModal } from "@/components/map/AlertCreationModal";
import {
  fetchHealthMap,
  fetchSanitaryAlerts,
  type HealthMapDto,
  type HealthMapGranularity,
  type HealthMapZone,
  type SanitaryAlertRow
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { FilterPills } from "@/components/layout/FilterPills";
import { Map, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const HealthMapbox = dynamic(
  () => import("@/components/map/HealthMapbox").then((m) => m.HealthMapbox),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 rounded-3xl glass-card animate-pulse" />
    )
  }
);

const PERIODS = ["7", "30", "90", "365"] as const;
const GRANULARITIES = ["sector", "city", "country"] as const;

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
  info: "bg-primary/10 text-primary border-primary/25",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  critical: "bg-red-100 text-red-900 border-red-200"
};

export default function CarteSanitairePage() {
  const t = useTranslations("map");
  const { token, ready } = useAdminToken();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30");
  const [granularity, setGranularity] =
    useState<HealthMapGranularity>("sector");
  const periodDays = periodToDays(periodKey);
  const [data, setData] = useState<HealthMapDto | null>(null);
  const [alerts, setAlerts] = useState<SanitaryAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchHealthMap(token, periodDays, granularity),
      fetchSanitaryAlerts(token)
    ])
      .then(([map, list]) => {
        setData(map);
        setAlerts(list);
        setSelectedZoneId(null);
      })
      .catch(() => setError(t("loadError")))
      .finally(() => setLoading(false));
  }, [token, periodDays, granularity, t]);

  useEffect(() => {
    load();
  }, [load]);

  const zones = data?.zones ?? [];
  const maxActive = useMemo(
    () => Math.max(0, ...zones.map((z) => z.activeCases)),
    [zones]
  );

  const displayedZones = useMemo(() => {
    const sorted = [...zones].sort((a, b) => b.activeCases - a.activeCases);
    if (selectedZoneId) {
      return sorted.filter((z) => z.id === selectedZoneId);
    }
    return sorted;
  }, [zones, selectedZoneId]);

  if (!ready || !token) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell wide>
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
            <FilterPills
              items={GRANULARITIES}
              value={granularity}
              onChange={setGranularity}
              label={(g) => t(`granularity.${g}` as "granularity.sector")}
            />
            <AlertCreationModal accessToken={token} onCreated={load} />
          </div>
        }
      />

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {data?.truncated ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t("truncated")}
        </p>
      ) : null}

      <AdminSection icon={Map} title={t("title")} description={t("subtitle")} bare>
      {loading ? (
        <div className="h-[420px] rounded-3xl glass-card animate-pulse" />
      ) : error ? null : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {t("activePoints", { count: data.points.length })} ·{" "}
              {t("zonesCount", { count: zones.length })}
            </span>
            {selectedZoneId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedZoneId(null)}
              >
                {t("clearZoneFilter")}
              </Button>
            ) : null}
          </div>
          <HealthMapbox
            points={data.points}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onZoneSelect={setSelectedZoneId}
            className="h-[420px] w-full rounded-3xl border border-white/60 shadow-glass"
          />
        </>
      ) : null}
      </AdminSection>

      <AdminSection icon={MapPinned} title={t("regions")} bare>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t(`zonePanelTitle.${granularity}` as "zonePanelTitle.sector")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">…</p>
            ) : displayedZones.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {displayedZones.map((z) => (
                  <ZoneCard
                    key={z.id}
                    zone={z}
                    maxActive={maxActive}
                    selected={z.id === selectedZoneId}
                    onSelect={() =>
                      setSelectedZoneId((prev) =>
                        prev === z.id ? null : z.id
                      )
                    }
                    t={t}
                  />
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
      </AdminSection>
    </AdminPageShell>
  );
}

function ZoneCard({
  zone,
  maxActive,
  selected,
  onSelect,
  t
}: {
  zone: HealthMapZone;
  maxActive: number;
  selected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof useTranslations<"map">>;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-2xl p-4 border transition w-full",
        heatColor(zone.activeCases, maxActive),
        selected && "ring-2 ring-violet-600 ring-offset-2"
      )}
    >
      <p className="font-bold">{zone.label}</p>
      {zone.parentLabel ? (
        <p className="text-xs mt-0.5 opacity-80">{zone.parentLabel}</p>
      ) : null}
      <p className="text-sm mt-2 opacity-90">
        {t("activeCases", { count: zone.activeCases })}
      </p>
      <p className="text-xs mt-1 opacity-80">
        {t("farms", { count: zone.farmCount })} ·{" "}
        {t("periodCases", { count: zone.totalCasesInPeriod })}
      </p>
      {zone.topDiseases.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs opacity-90">
          {zone.topDiseases.map((d) => (
            <li key={d.name}>
              {d.name} ({d.count})
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}
