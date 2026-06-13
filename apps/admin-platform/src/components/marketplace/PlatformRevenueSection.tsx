"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Coins, Receipt, TrendingUp } from "lucide-react";
import {
  fetchAdminPlatformRevenue,
  type AdminPlatformRevenueDto
} from "@/lib/api";
import { FilterPills } from "@/components/layout/FilterPills";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { TrackBarChart } from "@/components/charts/TrackBarChart";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const PERIODS = ["7d", "30d", "90d", "all"] as const;
type Period = (typeof PERIODS)[number];

type Props = {
  token: string;
};

export function PlatformRevenueSection({ token }: Props) {
  const t = useTranslations("marketplace");
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AdminPlatformRevenueDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAdminPlatformRevenue(token, period)
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, period]);

  const seriesChart = (data?.series ?? []).map((p) => ({
    label: p.date.slice(5),
    value: Math.round(p.commission)
  }));

  return (
    <div className="space-y-6">
      <FilterPills
        items={[...PERIODS]}
        value={period}
        onChange={setPeriod}
        label={(id) => t(`revenue.period.${id}`)}
      />

      {loading ? (
        <p className="text-muted-foreground">…</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label={t("revenue.totalCommission")}
              value={`${Math.round(data.totalCommission).toLocaleString("fr-FR")} XOF`}
              variant="blue"
              icon={<Coins className="size-4" />}
            />
            <KpiCard
              label={t("revenue.totalGross")}
              value={`${Math.round(data.totalGross).toLocaleString("fr-FR")} XOF`}
              variant="indigo"
              icon={<TrendingUp className="size-4" />}
            />
            <KpiCard
              label={t("revenue.transactionCount")}
              value={String(data.transactionCount)}
              variant="warning"
              icon={<Receipt className="size-4" />}
            />
          </div>

          {seriesChart.length > 0 ? (
            <ChartCard title={t("revenue.dailySeries")} contentClassName="pb-6">
              <TrackBarChart
                data={seriesChart}
                height={240}
                formatValue={(v) => `${v.toLocaleString("fr-FR")} XOF`}
              />
            </ChartCard>
          ) : null}

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("revenue.colListing")}</TableHead>
                    <TableHead className="text-right">{t("revenue.colGross")}</TableHead>
                    <TableHead className="text-right">{t("revenue.colCommission")}</TableHead>
                    <TableHead>{t("revenue.colDate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.listingTitle}</TableCell>
                      <TableCell className="text-right">
                        {Math.round(r.grossAmount).toLocaleString("fr-FR")} XOF
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {Math.round(r.commissionAmount).toLocaleString("fr-FR")} XOF
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.collectedAt).toLocaleString("fr-FR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
