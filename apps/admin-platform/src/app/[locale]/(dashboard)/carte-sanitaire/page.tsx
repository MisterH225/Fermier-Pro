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
import { useAdminAccess } from "@/lib/admin-access-context";
import { useAdminToken } from "@/lib/useAdminToken";
import { useInstitutionPreview } from "@/lib/institution-preview-context";
import { InstitutionPreviewBanner } from "@/components/institution/InstitutionPreviewBanner";
import { InstitutionPreviewSelector } from "@/components/institution/InstitutionPreviewSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { FilterPills } from "@/components/layout/FilterPills";
import { Map, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  deriveDepartmentStatsFromZones,
  extractDepartmentCode,
  zoneMatchesDepartment
} from "@/components/map/health-map-choropleth";

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
const GRANULARITIES = ["sector", "city", "department", "country"] as const;

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
  const { profile } = useAdminAccess();
  const { token, ready } = useAdminToken();
  const { viewAsInstitutionId, isPreviewActive } = useInstitutionPreview();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30");
  const [granularity, setGranularity] =
    useState<HealthMapGranularity>("sector");
  const [diagnosisFilter, setDiagnosisFilter] = useState<string>("");
  const [diagnosisOptions, setDiagnosisOptions] = useState<string[]>([]);
  const periodDays = periodToDays(periodKey);
  const [data, setData] = useState<HealthMapDto | null>(null);
  const [alerts, setAlerts] = useState<SanitaryAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const isAggregated =
    data?.mode === "aggregated" ||
    profile?.role === "institution" ||
    isPreviewActive;

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const mode =
      profile?.role === "institution" || isPreviewActive
        ? "aggregated"
        : undefined;
    Promise.all([
      fetchHealthMap(token, periodDays, granularity, {
        mode,
        viewAsInstitutionId,
        diagnosis: diagnosisFilter || null
      }),
      fetchSanitaryAlerts(token)
    ])
      .then(([map, list]) => {
        setData(map);
        setAlerts(list);
        setSelectedZoneId(null);
        if (!diagnosisFilter) {
          const names = new Set<string>();
          for (const zone of map.zones) {
            for (const d of zone.topDiseases ?? []) {
              if (d.name?.trim()) names.add(d.name.trim());
            }
          }
          setDiagnosisOptions([...names].sort((a, b) => a.localeCompare(b)));
        }
      })
      .catch(() => setError(t("loadError")))
      .finally(() => setLoading(false));
  }, [
    token,
    periodDays,
    granularity,
    diagnosisFilter,
    profile?.role,
    isPreviewActive,
    viewAsInstitutionId,
    t
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const zones = data?.zones ?? [];
  const points = data?.points ?? [];
  const maxActive = useMemo(
    () =>
      Math.max(
        0,
        ...zones.map((z) => (z.masked ? 0 : (z.activeCases ?? 0)))
      ),
    [zones]
  );

  const displayedZones = useMemo(() => {
    const sorted = [...zones].sort(
      (a, b) => (b.activeCases ?? 0) - (a.activeCases ?? 0)
    );
    if (selectedZoneId) {
      return sorted.filter((z) => zoneMatchesDepartment(z.id, selectedZoneId));
    }
    return sorted;
  }, [zones, selectedZoneId]);

  const departmentStats = useMemo(() => {
    if (!isAggregated || granularity !== "department") return undefined;
    return deriveDepartmentStatsFromZones(zones);
  }, [isAggregated, granularity, zones]);

  const mapMode = useMemo(
    () =>
      isAggregated && granularity === "department" ? ("choropleth" as const) : undefined,
    [isAggregated, granularity]
  );

  if (!ready || !token) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell wide>
      <InstitutionPreviewBanner />
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <div className="flex flex-wrap items-end gap-2">
            {profile?.role === "superadmin" ? (
              <InstitutionPreviewSelector />
            ) : null}
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
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>{t("diagnosisFilter")}</span>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                value={diagnosisFilter}
                onChange={(e) => setDiagnosisFilter(e.target.value)}
                title={t("diagnosisHint")}
              >
                <option value="">{t("diagnosisAll")}</option>
                {diagnosisOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {!isAggregated ? (
              <AlertCreationModal accessToken={token} onCreated={load} />
            ) : null}
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
              {isAggregated
                ? t("aggregatedMode")
                : t("activePoints", { count: points.length })}{" "}
              · {t("zonesCount", { count: zones.length })}
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
            points={isAggregated ? undefined : points}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onZoneSelect={setSelectedZoneId}
            mapDataMode={data.mode}
            granularity={granularity}
            departmentStats={departmentStats}
            mode={mapMode}
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
                    selected={zoneMatchesDepartment(z.id, selectedZoneId)}
                    onSelect={() =>
                      setSelectedZoneId((prev) => {
                        const key =
                          z.level === "department"
                            ? extractDepartmentCode(z.id)
                            : z.id;
                        const matches =
                          prev === z.id ||
                          prev === key ||
                          (prev != null && zoneMatchesDepartment(z.id, prev));
                        return matches ? null : key;
                      })
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
            {safeAlerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noAlerts")}</p>
            ) : (
              <ul className="space-y-3 text-sm max-h-80 overflow-y-auto">
                {safeAlerts.map((a) => (
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
  const masked = zone.masked === true;
  const activeCases = zone.activeCases ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-2xl p-4 border transition w-full",
        masked ? "bg-muted text-muted-foreground" : heatColor(activeCases, maxActive),
        selected && "ring-2 ring-violet-600 ring-offset-2"
      )}
    >
      <p className="font-bold">{zone.label}</p>
      {zone.parentLabel ? (
        <p className="text-xs mt-0.5 opacity-80">{zone.parentLabel}</p>
      ) : null}
      {masked ? (
        <p className="text-sm mt-2 italic">{t("maskedZone")}</p>
      ) : (
        <>
          <p className="text-sm mt-2 opacity-90">
            {t("activeCases", { count: activeCases })}
          </p>
          <p className="text-xs mt-1 opacity-80">
            {t("farms", { count: zone.farmCount ?? 0 })} ·{" "}
            {t("periodCases", { count: zone.totalCasesInPeriod ?? 0 })}
          </p>
          {(zone.topDiseases ?? []).length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs opacity-90">
              {zone.topDiseases!.map((d) => (
                <li key={d.name}>
                  {d.name} ({d.count})
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </button>
  );
}
