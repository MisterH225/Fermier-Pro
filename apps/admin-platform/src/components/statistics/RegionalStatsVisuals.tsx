"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Baby,
  HeartPulse,
  PawPrint,
  ShoppingBag,
  Stethoscope,
  TrendingUp,
  Users
} from "lucide-react";
import type { InstitutionStatSection } from "@/lib/institution-stat-sections";
import type {
  RegionalStatsCoverage,
  RegionalStatsDepartmentRow
} from "@/lib/api";
import { ChartCard } from "@/components/charts/ChartCard";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { HorizontalRankChart } from "@/components/charts/HorizontalRankChart";
import { ProportionBar } from "@/components/charts/ProportionBar";
import { SemiGaugeChart } from "@/components/charts/SemiGaugeChart";
import { Sparkline } from "@/components/charts/Sparkline";
import {
  StackedColumnChart,
  type StackedColumnRow
} from "@/components/charts/StackedColumnChart";
import { OverviewStatCard } from "@/components/dashboard/OverviewStatCard";
import {
  CHART_BLUE,
  CHART_DARK,
  CHART_LIME,
  CHART_PALETTE
} from "@/components/charts/chart-theme";

type Props = {
  section: InstitutionStatSection;
  departments: RegionalStatsDepartmentRow[];
  coverage?: RegionalStatsCoverage;
  national?: Record<string, unknown>;
};

function isVisible(row: RegionalStatsDepartmentRow): boolean {
  return row.masked !== true;
}

function pct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 10;
}

function sumRecord(rec: Record<string, number> | undefined): number {
  if (!rec) return 0;
  return Object.values(rec).reduce((s, n) => s + n, 0);
}

function mergeRecords(
  rows: RegionalStatsDepartmentRow[],
  pick: (r: RegionalStatsDepartmentRow) => Record<string, number> | undefined
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const src = pick(row);
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

function topKeys(rec: Record<string, number>, n: number): string[] {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function shortDept(code: string): string {
  return code.replace(/^CI-DEP-/, "").replace(/^CI-/, "");
}

function ChartLead({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground mb-4">{children}</p>;
}

const CHART_MUTED_SAFE = "#94A3B8";

function KpiWithSpark({
  label,
  value,
  spark,
  accent,
  icon
}: {
  label: string;
  value: number | string;
  spark: number[];
  accent?: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 backdrop-blur-md shadow-glass p-5 min-h-[148px] flex flex-col justify-between">
      {icon ? (
        <span className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary/70">
          {(() => {
            const Icon = icon;
            return <Icon className="size-4" />;
          })()}
        </span>
      ) : null}
      <div>
        <p className="text-sm text-muted-foreground font-medium pr-10">{label}</p>
        <p className="text-3xl font-extrabold mt-2 tabular-nums tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </div>
      <Sparkline values={spark} color={accent ?? CHART_BLUE} height={36} />
    </div>
  );
}

export function RegionalStatsVisuals({
  section,
  departments,
  coverage,
  national
}: Props) {
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

  const deptSpark = (pick: (d: RegionalStatsDepartmentRow) => number) =>
    visible.map(pick);

  if (section === "mortality") {
    const total = visible.reduce((s, d) => s + (d.mortalityHeadcount ?? 0), 0);
    const over = visible.filter((d) => d.overmortality).length;
    const causes = mergeRecords(visible, (r) => r.mortalityByCause);
    const topCauses = topKeys(causes, 4);
    const stacked: StackedColumnRow[] = visible.map((d) => {
      const row: StackedColumnRow = {
        label: shortDept(d.departmentCode)
      };
      for (const c of topCauses) {
        row[c] = d.mortalityByCause?.[c] ?? 0;
      }
      return row;
    });
    const gauge = topCauses.map((c, i) => ({
      name: c,
      value: causes[c] ?? 0,
      color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));
    const rank = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value: d.mortalityHeadcount ?? 0
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiWithSpark
            label={t("mortality.kpiTotal")}
            value={total}
            spark={deptSpark((d) => d.mortalityHeadcount ?? 0)}
            icon={Activity}
            accent="#EF4444"
          />
          <OverviewStatCard
            compact
            label={t("mortality.kpiOver")}
            value={over}
            accent="#F59E0B"
            icon={HeartPulse}
          />
          <OverviewStatCard
            compact
            label={t("mortality.kpiFarms")}
            value={coverage?.farmCount ?? visible.reduce((s, d) => s + d.farmCount, 0)}
            accent={CHART_DARK}
            icon={PawPrint}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("mortality.stackTitle")}>
            <ChartLead>{t("mortality.stackLead")}</ChartLead>
            <StackedColumnChart
              data={stacked}
              series={topCauses.map((c, i) => ({
                key: c,
                label: c,
                color: CHART_PALETTE[i % CHART_PALETTE.length]
              }))}
              height={280}
            />
          </ChartCard>
          <ChartCard title={t("mortality.gaugeTitle")}>
            <ChartLead>{t("mortality.gaugeLead")}</ChartLead>
            <SemiGaugeChart
              data={gauge}
              centerValue={total}
              centerLabel={t("mortality.kpiTotal")}
              height={200}
            />
          </ChartCard>
        </div>
        <ChartCard title={t("mortality.rankTitle")}>
          <ChartLead>{t("mortality.lead")}</ChartLead>
          <HorizontalRankChart data={rank} />
        </ChartCard>
      </div>
    );
  }

  if (section === "herd") {
    const byCat = mergeRecords(visible, (r) => r.animalCountByCategory);
    const totalAnimals = sumRecord(byCat);
    const donut = Object.entries(byCat).map(([name, value], i) => ({
      name,
      value,
      color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));
    const area = visible.map((d) => ({
      date: shortDept(d.departmentCode),
      herd: sumRecord(d.animalCountByCategory)
    }));
    const rank = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value: sumRecord(d.animalCountByCategory)
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiWithSpark
            label={t("herd.kpiAnimals")}
            value={totalAnimals}
            spark={deptSpark((d) => sumRecord(d.animalCountByCategory))}
            icon={PawPrint}
          />
          <OverviewStatCard
            featured
            label={t("herd.kpiFarms")}
            value={coverage?.farmCount ?? visible.reduce((s, d) => s + d.farmCount, 0)}
            icon={Users}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("herd.donutTitle")}>
            <ChartLead>{t("herd.donutLead")}</ChartLead>
            <DonutChart
              data={donut}
              centerValue={totalAnimals}
              centerLabel={t("herd.kpiAnimals")}
            />
          </ChartCard>
          <ChartCard title={t("herd.areaTitle")}>
            <ChartLead>{t("herd.lead")}</ChartLead>
            <AreaTrendChart
              data={area}
              dataKey="herd"
              height={240}
              hideXAxis={false}
              color={CHART_LIME}
            />
          </ChartCard>
        </div>
        <ChartCard title={t("herd.rankTitle")}>
          <ChartLead>{t("herd.rankLead")}</ChartLead>
          <HorizontalRankChart data={rank} />
        </ChartCard>
      </div>
    );
  }

  if (section === "reproduction") {
    const born = visible.reduce((s, d) => s + (d.bornAlive ?? 0), 0);
    const still = visible.reduce((s, d) => s + (d.stillborn ?? 0), 0);
    const completed = visible.reduce((s, d) => s + (d.gestationsCompleted ?? 0), 0);
    const lost =
      visible.reduce((s, d) => s + (d.gestationsAborted ?? 0), 0) +
      visible.reduce((s, d) => s + (d.gestationsLost ?? 0), 0);
    const avgFarrow =
      visible.reduce((s, d) => s + pct(d.tauxMiseBas), 0) /
      Math.max(visible.length, 1);
    const stacked = visible.map((d) => ({
      label: shortDept(d.departmentCode),
      bornAlive: d.bornAlive ?? 0,
      stillborn: d.stillborn ?? 0,
      weaned: d.weanedEstimate ?? 0
    }));
    const gauge = [
      { name: t("reproduction.completed"), value: completed, color: CHART_LIME },
      { name: t("reproduction.lost"), value: lost, color: "#F59E0B" }
    ];
    const iaRank = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value: pct(d.partIA)
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiWithSpark
            label={t("reproduction.kpiBorn")}
            value={born}
            spark={deptSpark((d) => d.bornAlive ?? 0)}
            icon={Baby}
            accent={CHART_LIME}
          />
          <OverviewStatCard
            compact
            label={t("reproduction.kpiStill")}
            value={still}
            accent="#F59E0B"
          />
          <OverviewStatCard
            compact
            label={t("reproduction.kpiFarrow")}
            value={`${avgFarrow.toFixed(1)} %`}
            accent={CHART_BLUE}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("reproduction.stackTitle")}>
            <ChartLead>{t("reproduction.bornLead")}</ChartLead>
            <StackedColumnChart
              data={stacked}
              stacked={false}
              series={[
                { key: "bornAlive", label: t("reproduction.seriesBorn"), color: CHART_BLUE },
                { key: "stillborn", label: t("reproduction.seriesStill"), color: "#F59E0B" },
                { key: "weaned", label: t("reproduction.seriesWeaned"), color: CHART_LIME }
              ]}
              height={280}
            />
          </ChartCard>
          <ChartCard title={t("reproduction.gaugeTitle")}>
            <ChartLead>{t("reproduction.farrowingLead")}</ChartLead>
            <SemiGaugeChart
              data={gauge}
              centerValue={`${avgFarrow.toFixed(0)}%`}
              centerLabel={t("reproduction.kpiFarrow")}
              height={200}
            />
          </ChartCard>
        </div>
        <ChartCard title={t("reproduction.iaTitle")}>
          <ChartLead>{t("reproduction.iaLead")}</ChartLead>
          <HorizontalRankChart data={iaRank} formatValue={(v) => `${v} %`} />
        </ChartCard>
      </div>
    );
  }

  if (section === "growth") {
    const gmqOf = (d: RegionalStatsDepartmentRow) => {
      const vals = Object.values(d.avgGmqByCategory ?? {});
      return vals.length
        ? vals.reduce((s, n) => s + n, 0) / vals.length
        : 0;
    };
    const avg =
      visible.reduce((s, d) => s + gmqOf(d), 0) / Math.max(visible.length, 1);
    const area = visible.map((d) => ({
      date: shortDept(d.departmentCode),
      gmq: Math.round(gmqOf(d) * 100) / 100
    }));
    const rank = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value: Math.round(gmqOf(d) * 100) / 100
      }))
      .sort((a, b) => b.value - a.value);
    const cats = mergeRecords(visible, (r) => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(r.avgGmqByCategory ?? {})) {
        out[k] = v;
      }
      return out;
    });
    // For donut use relative weight of categories present (count of depts reporting)
    const catSegments = Object.keys(cats).map((name, i) => ({
      name,
      value: visible.filter((d) => (d.avgGmqByCategory?.[name] ?? 0) > 0).length || 1,
      color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiWithSpark
            label={t("growth.kpiAvg")}
            value={`${avg.toFixed(2)} kg/j`}
            spark={deptSpark(gmqOf)}
            icon={TrendingUp}
          />
          <OverviewStatCard
            compact
            label={t("growth.kpiDepts")}
            value={visible.length}
            accent={CHART_DARK}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("growth.areaTitle")}>
            <ChartLead>{t("growth.lead")}</ChartLead>
            <AreaTrendChart
              data={area}
              dataKey="gmq"
              height={260}
              hideXAxis={false}
              color="#0EA5E9"
            />
          </ChartCard>
          <ChartCard title={t("growth.catTitle")}>
            <ChartLead>{t("growth.catLead")}</ChartLead>
            <DonutChart
              data={catSegments}
              centerValue={Object.keys(cats).length}
              centerLabel={t("growth.catCenter")}
            />
          </ChartCard>
        </div>
        <ChartCard title={t("growth.rankTitle")}>
          <ChartLead>{t("growth.rankLead")}</ChartLead>
          <HorizontalRankChart
            data={rank}
            formatValue={(v) => `${v} kg/j`}
          />
        </ChartCard>
      </div>
    );
  }

  if (section === "vetCoverage") {
    const total = visible.reduce(
      (s, d) => s + (d.vetConsultationsCount ?? 0),
      0
    );
    const donut = visible.map((d, i) => ({
      name: shortDept(d.departmentCode),
      value: d.vetConsultationsCount ?? 0,
      color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));
    const area = visible.map((d) => ({
      date: shortDept(d.departmentCode),
      consults: d.vetConsultationsCount ?? 0
    }));
    const perFarm = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value:
          d.farmCount > 0
            ? Math.round(((d.vetConsultationsCount ?? 0) / d.farmCount) * 10) /
              10
            : 0
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiWithSpark
            label={t("vetCoverage.kpiTotal")}
            value={total}
            spark={deptSpark((d) => d.vetConsultationsCount ?? 0)}
            icon={Stethoscope}
          />
          <OverviewStatCard
            compact
            label={t("vetCoverage.kpiPerFarm")}
            value={
              (coverage?.farmCount ?? 1) > 0
                ? (total / (coverage?.farmCount ?? 1)).toFixed(1)
                : "—"
            }
            accent="#6366F1"
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("vetCoverage.donutTitle")}>
            <ChartLead>{t("vetCoverage.lead")}</ChartLead>
            <DonutChart
              data={donut}
              centerValue={total}
              centerLabel={t("vetCoverage.kpiTotal")}
            />
          </ChartCard>
          <ChartCard title={t("vetCoverage.areaTitle")}>
            <ChartLead>{t("vetCoverage.areaLead")}</ChartLead>
            <AreaTrendChart
              data={area}
              dataKey="consults"
              height={240}
              hideXAxis={false}
              color="#6366F1"
            />
          </ChartCard>
        </div>
        <ChartCard title={t("vetCoverage.rankTitle")}>
          <ChartLead>{t("vetCoverage.rankLead")}</ChartLead>
          <HorizontalRankChart
            data={perFarm}
            formatValue={(v) => `${v} / ferme`}
          />
        </ChartCard>
      </div>
    );
  }

  if (section === "economy") {
    const sales = visible.reduce((s, d) => s + (d.exitsSaleHeadcount ?? 0), 0);
    const slaughter = visible.reduce(
      (s, d) => s + (d.exitsSlaughterHeadcount ?? 0),
      0
    );
    const prices = visible
      .map((d) => d.exitsSaleAvgPricePerKg)
      .filter((p): p is number => p != null && Number.isFinite(p));
    const avgPrice =
      prices.length > 0
        ? prices.reduce((s, p) => s + p, 0) / prices.length
        : null;
    const grouped = visible.map((d) => ({
      label: shortDept(d.departmentCode),
      sale: d.exitsSaleHeadcount ?? 0,
      slaughter: d.exitsSlaughterHeadcount ?? 0
    }));
    const area = visible.map((d) => ({
      date: shortDept(d.departmentCode),
      sales: d.exitsSaleHeadcount ?? 0
    }));

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiWithSpark
            label={t("economy.kpiSales")}
            value={sales}
            spark={deptSpark((d) => d.exitsSaleHeadcount ?? 0)}
            icon={ShoppingBag}
            accent={CHART_LIME}
          />
          <OverviewStatCard
            compact
            label={t("economy.kpiSlaughter")}
            value={slaughter}
            accent={CHART_DARK}
          />
          <OverviewStatCard
            compact
            label={t("economy.kpiPrice")}
            value={avgPrice != null ? `${Math.round(avgPrice)}` : "—"}
            accent={CHART_BLUE}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("economy.groupTitle")}>
            <ChartLead>{t("economy.groupLead")}</ChartLead>
            <StackedColumnChart
              data={grouped}
              stacked={false}
              series={[
                { key: "sale", label: t("economy.seriesSale"), color: CHART_LIME },
                {
                  key: "slaughter",
                  label: t("economy.seriesSlaughter"),
                  color: CHART_DARK
                }
              ]}
              height={280}
            />
          </ChartCard>
          <ChartCard title={t("economy.areaTitle")}>
            <ChartLead>{t("economy.lead")}</ChartLead>
            <AreaTrendChart
              data={area}
              dataKey="sales"
              height={280}
              hideXAxis={false}
              color={CHART_LIME}
            />
          </ChartCard>
        </div>
      </div>
    );
  }

  if (section === "health") {
    const suspicions = visible.reduce(
      (s, d) => s + (d.totalSuspicionsDeclared ?? 0),
      0
    );
    const avgInc =
      visible.reduce((s, d) => s + (d.incidencePerThousand ?? 0), 0) /
      Math.max(visible.length, 1);
    const diagMap: Record<string, number> = {};
    for (const d of visible) {
      for (const row of d.suspicionsByDiagnosis ?? []) {
        diagMap[row.diagnosis] =
          (diagMap[row.diagnosis] ?? 0) + row.suspicionsDeclared;
      }
    }
    const donut = Object.entries(diagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({
        name,
        value,
        color: CHART_PALETTE[i % CHART_PALETTE.length]
      }));
    const rank = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value: d.incidencePerThousand ?? 0
      }))
      .sort((a, b) => b.value - a.value);
    const causes = mergeRecords(visible, (r) => r.mortalityByCause);
    const proportion = Object.entries(causes).map(([name, value], i) => ({
      name,
      value,
      color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiWithSpark
            label={t("health.kpiSuspicions")}
            value={suspicions}
            spark={deptSpark((d) => d.totalSuspicionsDeclared ?? 0)}
            icon={HeartPulse}
            accent="#EF4444"
          />
          <OverviewStatCard
            compact
            label={t("health.kpiIncidence")}
            value={avgInc.toFixed(1)}
            accent="#F59E0B"
          />
          <OverviewStatCard
            compact
            label={t("health.kpiDiagnoses")}
            value={Object.keys(diagMap).length}
            accent={CHART_DARK}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("health.donutTitle")}>
            <ChartLead>{t("health.donutLead")}</ChartLead>
            <DonutChart
              data={donut}
              centerValue={suspicions}
              centerLabel={t("health.kpiSuspicions")}
            />
          </ChartCard>
          <ChartCard title={t("health.propTitle")}>
            <ChartLead>{t("health.propLead")}</ChartLead>
            <ProportionBar data={proportion} />
          </ChartCard>
        </div>
        <ChartCard title={t("health.title")}>
          <ChartLead>{t("health.lead")}</ChartLead>
          <HorizontalRankChart
            data={rank}
            formatValue={(v) => `${v} /1 000`}
          />
        </ChartCard>
      </div>
    );
  }

  if (section === "lifecycle") {
    const exitsAgg = {
      sale: 0,
      slaughter: 0,
      mortality: 0,
      transfer: 0
    };
    for (const d of visible) {
      exitsAgg.sale += d.exitsByKind?.sale?.headcount ?? d.exitsSaleHeadcount ?? 0;
      exitsAgg.slaughter +=
        d.exitsByKind?.slaughter?.headcount ?? d.exitsSlaughterHeadcount ?? 0;
      exitsAgg.mortality += d.exitsByKind?.mortality?.headcount ?? 0;
      exitsAgg.transfer += d.exitsByKind?.transfer?.headcount ?? 0;
    }
    const proportion = [
      { name: t("lifecycle.kindSale"), value: exitsAgg.sale, color: CHART_LIME },
      {
        name: t("lifecycle.kindSlaughter"),
        value: exitsAgg.slaughter,
        color: CHART_DARK
      },
      {
        name: t("lifecycle.kindMortality"),
        value: exitsAgg.mortality,
        color: "#EF4444"
      },
      {
        name: t("lifecycle.kindTransfer"),
        value: exitsAgg.transfer,
        color: CHART_BLUE
      }
    ];
    const ages = visible
      .map((d) => d.avgAgeAtSaleDays)
      .filter((a): a is number => a != null);
    const avgAge =
      ages.length > 0 ? ages.reduce((s, a) => s + a, 0) / ages.length : null;
    const fat = visible
      .map((d) => d.avgFatteningDurationDays)
      .filter((a): a is number => a != null);
    const avgFat =
      fat.length > 0 ? fat.reduce((s, a) => s + a, 0) / fat.length : null;
    const saleRate =
      visible.reduce((s, d) => s + pct(d.tauxVenteCheptel), 0) /
      Math.max(visible.length, 1);
    const gauge = [
      {
        name: t("lifecycle.kindSale"),
        value: exitsAgg.sale,
        color: CHART_LIME
      },
      {
        name: t("lifecycle.otherExits"),
        value: exitsAgg.slaughter + exitsAgg.mortality + exitsAgg.transfer,
        color: CHART_MUTED_SAFE
      }
    ];
    const rank = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value: pct(d.tauxVenteCheptel)
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <OverviewStatCard
            featured
            label={t("lifecycle.kpiSaleRate")}
            value={`${saleRate.toFixed(1)} %`}
            icon={ShoppingBag}
          />
          <OverviewStatCard
            compact
            label={t("lifecycle.kpiAgeSale")}
            value={avgAge != null ? `${Math.round(avgAge)} j` : "—"}
            accent={CHART_BLUE}
          />
          <OverviewStatCard
            compact
            label={t("lifecycle.kpiFattening")}
            value={avgFat != null ? `${Math.round(avgFat)} j` : "—"}
            accent={CHART_LIME}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("lifecycle.propTitle")}>
            <ChartLead>{t("lifecycle.propLead")}</ChartLead>
            <ProportionBar data={proportion} height={32} />
          </ChartCard>
          <ChartCard title={t("lifecycle.gaugeTitle")}>
            <ChartLead>{t("lifecycle.gaugeLead")}</ChartLead>
            <SemiGaugeChart
              data={gauge}
              centerValue={`${saleRate.toFixed(0)}%`}
              centerLabel={t("lifecycle.kpiSaleRate")}
              height={200}
            />
          </ChartCard>
        </div>
        <ChartCard title={t("lifecycle.title")}>
          <ChartLead>{t("lifecycle.lead")}</ChartLead>
          <HorizontalRankChart data={rank} formatValue={(v) => `${v} %`} />
        </ChartCard>
      </div>
    );
  }

  if (section === "adoption") {
    const active = visible.reduce((s, d) => s + (d.activeFarmsCount ?? 0), 0);
    const roles = mergeRecords(visible, (r) => r.activeUsersByRole);
    const donut = Object.entries(roles).map(([name, value], i) => ({
      name,
      value,
      color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));
    const rank = visible
      .map((d) => ({
        label: shortDept(d.departmentCode),
        value: d.activeFarmsCount ?? 0
      }))
      .sort((a, b) => b.value - a.value);
    const retention30 =
      typeof national?.retentionJ30 === "number"
        ? national.retentionJ30
        : null;
    const retention90 =
      typeof national?.retentionJ90 === "number"
        ? national.retentionJ90
        : null;
    const area = visible.map((d) => ({
      date: shortDept(d.departmentCode),
      active: d.activeFarmsCount ?? 0
    }));

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiWithSpark
            label={t("adoption.kpiActive")}
            value={active}
            spark={deptSpark((d) => d.activeFarmsCount ?? 0)}
            icon={Users}
          />
          <OverviewStatCard
            compact
            label={t("adoption.kpiRetention30")}
            value={
              retention30 != null ? `${(retention30 * 100).toFixed(0)} %` : "—"
            }
            accent={CHART_LIME}
          />
          <OverviewStatCard
            compact
            label={t("adoption.kpiRetention90")}
            value={
              retention90 != null ? `${(retention90 * 100).toFixed(0)} %` : "—"
            }
            accent={CHART_BLUE}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title={t("adoption.donutTitle")}>
            <ChartLead>{t("adoption.donutLead")}</ChartLead>
            <DonutChart
              data={donut}
              centerValue={sumRecord(roles)}
              centerLabel={t("adoption.kpiUsers")}
            />
          </ChartCard>
          <ChartCard title={t("adoption.areaTitle")}>
            <ChartLead>{t("adoption.lead")}</ChartLead>
            <AreaTrendChart
              data={area}
              dataKey="active"
              height={240}
              hideXAxis={false}
              color="#6366F1"
            />
          </ChartCard>
        </div>
        <ChartCard title={t("adoption.rankTitle")}>
          <ChartLead>{t("adoption.rankLead")}</ChartLead>
          <HorizontalRankChart data={rank} />
        </ChartCard>
      </div>
    );
  }

  return null;
}
