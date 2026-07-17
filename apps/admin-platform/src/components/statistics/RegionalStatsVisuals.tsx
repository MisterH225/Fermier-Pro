"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { InstitutionStatSection } from "@/lib/institution-stat-sections";
import type { RegionalStatsDepartmentRow } from "@/lib/api";
import { ChartCard } from "@/components/charts/ChartCard";
import { TrackBarChart } from "@/components/charts/TrackBarChart";
import { HorizontalRankChart } from "@/components/charts/HorizontalRankChart";

type Props = {
  section: InstitutionStatSection;
  departments: RegionalStatsDepartmentRow[];
};

function isVisible(row: RegionalStatsDepartmentRow): boolean {
  return row.masked !== true;
}

function pct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 10;
}

export function RegionalStatsVisuals({ section, departments }: Props) {
  const t = useTranslations("stats.regional.charts");
  const visible = useMemo(
    () => departments.filter(isVisible),
    [departments]
  );

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border bg-muted/30 px-4 py-3">
        {t("emptyMasked")}
      </p>
    );
  }

  if (section === "reproduction") {
    const born = visible.map((d) => ({
      label: d.departmentCode,
      value: d.bornAlive ?? 0
    }));
    const rates = visible.map((d) => ({
      label: d.departmentCode,
      value: pct(d.tauxMiseBas)
    }));
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("reproduction.bornTitle")}>
          <p className="text-sm text-muted-foreground mb-3">
            {t("reproduction.bornLead")}
          </p>
          <TrackBarChart data={born} height={240} hideXAxis={false} />
        </ChartCard>
        <ChartCard title={t("reproduction.farrowingTitle")}>
          <p className="text-sm text-muted-foreground mb-3">
            {t("reproduction.farrowingLead")}
          </p>
          <HorizontalRankChart
            data={rates}
            formatValue={(v) => `${v} %`}
          />
        </ChartCard>
      </div>
    );
  }

  if (section === "mortality") {
    const data = visible.map((d) => ({
      label: d.departmentCode,
      value: d.mortalityHeadcount ?? 0
    }));
    return (
      <ChartCard title={t("mortality.title")}>
        <p className="text-sm text-muted-foreground mb-3">{t("mortality.lead")}</p>
        <TrackBarChart data={data} height={260} hideXAxis={false} />
      </ChartCard>
    );
  }

  if (section === "herd") {
    const data = visible.map((d) => ({
      label: d.departmentCode,
      value: Object.values(d.animalCountByCategory ?? {}).reduce(
        (s, n) => s + n,
        0
      )
    }));
    return (
      <ChartCard title={t("herd.title")}>
        <p className="text-sm text-muted-foreground mb-3">{t("herd.lead")}</p>
        <TrackBarChart data={data} height={260} hideXAxis={false} />
      </ChartCard>
    );
  }

  if (section === "growth") {
    const data = visible.map((d) => {
      const vals = Object.values(d.avgGmqByCategory ?? {});
      const avg =
        vals.length > 0 ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
      return { label: d.departmentCode, value: Math.round(avg * 100) / 100 };
    });
    return (
      <ChartCard title={t("growth.title")}>
        <p className="text-sm text-muted-foreground mb-3">{t("growth.lead")}</p>
        <TrackBarChart
          data={data}
          height={260}
          hideXAxis={false}
          formatValue={(v) => `${v} kg/j`}
        />
      </ChartCard>
    );
  }

  if (section === "vetCoverage") {
    const data = visible.map((d) => ({
      label: d.departmentCode,
      value: d.vetConsultationsCount ?? 0
    }));
    return (
      <ChartCard title={t("vetCoverage.title")}>
        <p className="text-sm text-muted-foreground mb-3">
          {t("vetCoverage.lead")}
        </p>
        <TrackBarChart data={data} height={260} hideXAxis={false} />
      </ChartCard>
    );
  }

  if (section === "economy") {
    const data = visible.map((d) => ({
      label: d.departmentCode,
      value: d.exitsSaleHeadcount ?? 0
    }));
    return (
      <ChartCard title={t("economy.title")}>
        <p className="text-sm text-muted-foreground mb-3">{t("economy.lead")}</p>
        <TrackBarChart data={data} height={260} hideXAxis={false} />
      </ChartCard>
    );
  }

  if (section === "health") {
    const data = visible.map((d) => ({
      label: d.departmentCode,
      value: d.incidencePerThousand ?? 0
    }));
    return (
      <ChartCard title={t("health.title")}>
        <p className="text-sm text-muted-foreground mb-3">{t("health.lead")}</p>
        <HorizontalRankChart
          data={data}
          formatValue={(v) => `${v} /1 000`}
        />
      </ChartCard>
    );
  }

  if (section === "lifecycle") {
    const data = visible.map((d) => ({
      label: d.departmentCode,
      value: pct(d.tauxVenteCheptel)
    }));
    return (
      <ChartCard title={t("lifecycle.title")}>
        <p className="text-sm text-muted-foreground mb-3">
          {t("lifecycle.lead")}
        </p>
        <HorizontalRankChart data={data} formatValue={(v) => `${v} %`} />
      </ChartCard>
    );
  }

  if (section === "adoption") {
    const data = visible.map((d) => ({
      label: d.departmentCode,
      value: d.activeFarmsCount ?? 0
    }));
    return (
      <ChartCard title={t("adoption.title")}>
        <p className="text-sm text-muted-foreground mb-3">{t("adoption.lead")}</p>
        <TrackBarChart data={data} height={260} hideXAxis={false} />
      </ChartCard>
    );
  }

  return null;
}
