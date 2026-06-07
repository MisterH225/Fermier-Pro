"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from "recharts";
import {
  fetchAdminPigPriceChart,
  fetchAdminPigPriceStats,
  fetchAdminPigPriceTicker,
  type AdminPigPriceChartDto,
  type AdminPigPriceStatsDto
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPills } from "@/components/layout/FilterPills";

const PERIODS = ["7d", "30d", "3m", "12m"] as const;
const CATEGORIES = [
  { key: "porcelet", title: "🐣 Porcelets", color: "#FF6B35" },
  { key: "croissance", title: "📈 Croissance", color: "#00C9A7" },
  { key: "charcutier", title: "🐷 Charcutier", color: "#7C3AED" },
  { key: "reproducteur", title: "♻️ Reproducteurs", color: "#FFB800" }
] as const;

type Props = {
  token: string;
  compact?: boolean;
};

export function PigPriceIndexSection({ token, compact = false }: Props) {
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
    ]).then(([c, s, t]) => {
      setChart(c);
      setStats(s);
      setTicker(
        t.items
          .map(
            (i) =>
              `${i.icon} ${i.label}: ${i.pricePerKg != null ? Math.round(i.pricePerKg) : "—"} FCFA/kg`
          )
          .join(" · ")
      );
    });
  }, [token, period]);

  if (!chart) {
    return <p className="text-muted-foreground text-sm">…</p>;
  }

  if (compact) {
    const globalSeries = chart.series.find((s) => s.key === "porcelet");
    const spark = globalSeries?.points.slice(-7) ?? [];
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📊 PigPrice Index</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2 truncate">{ticker || "—"}</p>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <Area
                  type="monotone"
                  dataKey="avgPricePerKg"
                  stroke="#7C3AED"
                  fill="#7C3AED33"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  const combinedData = (() => {
    const map = new Map<string, Record<string, number>>();
    for (const s of chart.series.filter((x) => !x.dashed)) {
      for (const p of s.points) {
        const row = map.get(p.date) ?? { date: p.date as unknown as number };
        (row as Record<string, number>)[s.key] = p.avgPricePerKg;
        map.set(p.date, row as Record<string, number>);
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
          <h2 className="text-xl font-semibold">📊 PigPrice Index — Cours du marché porcin</h2>
          <p className="text-sm text-muted-foreground">
            Indice calculé depuis les transactions réelles sur la plateforme
          </p>
        </div>
        <FilterPills
          items={[...PERIODS]}
          value={period}
          onChange={setPeriod}
          label={(p) => p.toUpperCase()}
        />
      </div>

      <div className="rounded-lg bg-[#1A1D23] px-4 py-2 text-sm text-slate-200 overflow-hidden whitespace-nowrap">
        {ticker || "—"}
      </div>

      {chart.insufficientData ? (
        <p className="text-muted-foreground">{chart.message}</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => {
              const series = chart.series.find((s) => s.key === cat.key);
              const data = series?.points ?? [];
              return (
                <Card key={cat.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{cat.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id={`grad-${cat.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={cat.color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={cat.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                        <YAxis tick={{ fontSize: 10 }} width={48} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="avgPricePerKg"
                          stroke={cat.color}
                          fill={`url(#grad-${cat.key})`}
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vue globale — Toutes catégories</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={48} />
                  <Tooltip />
                  <Legend />
                  {CATEGORIES.map((cat) => (
                    <Line
                      key={cat.key}
                      type="monotone"
                      dataKey={cat.key}
                      stroke={cat.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {stats ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Statistiques de marché</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4">Catégorie</th>
                      <th className="py-2 pr-4">Aujourd&apos;hui</th>
                      <th className="py-2 pr-4">Var. 24h</th>
                      <th className="py-2 pr-4">Var. 7j</th>
                      <th className="py-2 pr-4">Max 30j</th>
                      <th className="py-2 pr-4">Min 30j</th>
                      <th className="py-2">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rows.map((row) => (
                      <tr key={row.category} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium">{row.label}</td>
                        <td className="py-2 pr-4">
                          {row.todayPrice != null ? Math.round(row.todayPrice) : "—"}
                        </td>
                        <td
                          className={`py-2 pr-4 ${
                            (row.variation24h ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {row.variation24h != null
                            ? `${row.variation24h > 0 ? "+" : ""}${row.variation24h.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {row.variation7d != null
                            ? `${row.variation7d > 0 ? "+" : ""}${row.variation7d.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">{row.high30d != null ? Math.round(row.high30d) : "—"}</td>
                        <td className="py-2 pr-4">{row.low30d != null ? Math.round(row.low30d) : "—"}</td>
                        <td className="py-2">{row.volume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
