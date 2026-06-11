"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  fetchAdminPigPriceChart,
  fetchAdminPigPriceStats,
  fetchAdminPigPriceTicker,
  type AdminPigPriceChartDto,
  type AdminPigPriceStatsDto
} from "@/lib/api";
import { FilterPills } from "@/components/layout/FilterPills";
import { ChartCard } from "@/components/charts/ChartCard";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { CHART_PALETTE } from "@/components/charts/chart-theme";

const PERIODS = ["7d", "30d", "3m", "12m"] as const;
const CATEGORY_KEYS = [
  { key: "porcelet", color: CHART_PALETTE[0] },
  { key: "croissance", color: CHART_PALETTE[1] },
  { key: "charcutier", color: CHART_PALETTE[2] },
  { key: "reproducteur", color: CHART_PALETTE[5] }
] as const;

type Props = {
  token: string;
  compact?: boolean;
};

export function PigPriceIndexSection({ token, compact = false }: Props) {
  const t = useTranslations("pigPrice");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("30d");
  const [chart, setChart] = useState<AdminPigPriceChartDto | null>(null);
  const [stats, setStats] = useState<AdminPigPriceStatsDto | null>(null);
  const [ticker, setTicker] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetchAdminPigPriceChart(token, period, "all"),
      fetchAdminPigPriceStats(token, period),
      fetchAdminPigPriceTicker(token)
    ]).then(([c, s, tickerRes]) => {
      setChart(c);
      setStats(s);
      setTicker(
        tickerRes.items
          .map((i) =>
            t("tickerItem", {
              icon: i.icon,
              label: i.label,
              price: i.pricePerKg != null ? Math.round(i.pricePerKg) : "—"
            })
          )
          .join(" · ")
      );
    });
  }, [token, period, t]);

  if (!chart) {
    return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  }

  if (compact) {
    const globalSeries = chart.series.find((s) => s.key === "porcelet");
    const spark = globalSeries?.points.slice(-7) ?? [];
    return (
      <ChartCard title={t("compactTitle")} contentClassName="pb-4">
        <p className="text-xs text-muted-foreground mb-3 truncate">{ticker || "—"}</p>
        <AreaTrendChart data={spark} dataKey="avgPricePerKg" height={72} showGrid={false} />
      </ChartCard>
    );
  }

  const combinedData = (() => {
    const map = new Map<string, Record<string, string | number>>();
    for (const s of chart.series.filter((x) => !x.dashed)) {
      for (const p of s.points) {
        const row = map.get(p.date) ?? { date: p.date };
        row[s.key] = p.avgPricePerKg;
        map.set(p.date, row);
      }
    }
    return [...map.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <FilterPills
          items={[...PERIODS]}
          value={period}
          onChange={setPeriod}
          label={(p) => p.toUpperCase()}
        />
      </div>

      <div className="rounded-2xl border border-white/60 bg-[#1E293B] px-4 py-2.5 text-sm text-slate-100 overflow-hidden whitespace-nowrap shadow-glass">
        {ticker || "—"}
      </div>

      {chart.insufficientData ? (
        <p className="text-muted-foreground">{chart.message}</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {CATEGORY_KEYS.map((cat) => {
              const series = chart.series.find((s) => s.key === cat.key);
              const data = series?.points ?? [];
              return (
                <ChartCard key={cat.key} title={t(`categories.${cat.key}`)} contentClassName="pb-4">
                  <AreaTrendChart
                    data={data}
                    dataKey="avgPricePerKg"
                    color={cat.color}
                    height={224}
                  />
                </ChartCard>
              );
            })}
          </div>

          <ChartCard title={t("globalView")} contentClassName="pb-4">
            <LineTrendChart
              data={combinedData}
              series={CATEGORY_KEYS.map((cat) => ({
                key: cat.key,
                color: cat.color,
                label: t(`categories.${cat.key}`)
              }))}
              height={320}
            />
          </ChartCard>

          {stats ? (
            <ChartCard title={t("marketStats")} contentClassName="pb-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/50">
                      <th className="py-2 pr-4">{t("table.category")}</th>
                      <th className="py-2 pr-4">{t("table.today")}</th>
                      <th className="py-2 pr-4">{t("table.var24h")}</th>
                      <th className="py-2 pr-4">{t("table.var7d")}</th>
                      <th className="py-2 pr-4">{t("table.high30d")}</th>
                      <th className="py-2 pr-4">{t("table.low30d")}</th>
                      <th className="py-2">{t("table.volume")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rows.map((row) => (
                      <tr key={row.category} className="border-b border-white/40">
                        <td className="py-2.5 pr-4 font-semibold">{row.label}</td>
                        <td className="py-2.5 pr-4 tabular-nums">
                          {row.todayPrice != null ? Math.round(row.todayPrice) : "—"}
                        </td>
                        <td
                          className={`py-2.5 pr-4 tabular-nums font-medium ${
                            (row.variation24h ?? 0) >= 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {row.variation24h != null
                            ? `${row.variation24h > 0 ? "+" : ""}${row.variation24h.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">
                          {row.variation7d != null
                            ? `${row.variation7d > 0 ? "+" : ""}${row.variation7d.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">
                          {row.high30d != null ? Math.round(row.high30d) : "—"}
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">
                          {row.low30d != null ? Math.round(row.low30d) : "—"}
                        </td>
                        <td className="py-2.5 tabular-nums">{row.volume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          ) : null}
        </>
      )}
    </div>
  );
}
