"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchAdminPlatformRevenue,
  type AdminPlatformRevenueDto
} from "@/lib/api";
import { FilterPills } from "@/components/layout/FilterPills";
import { KpiCard } from "@/components/dashboard/KpiCard";
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
            />
            <KpiCard
              label={t("revenue.totalGross")}
              value={`${Math.round(data.totalGross).toLocaleString("fr-FR")} XOF`}
              variant="indigo"
            />
            <KpiCard
              label={t("revenue.transactionCount")}
              value={String(data.transactionCount)}
              variant="warning"
            />
          </div>

          {data.series.length > 0 ? (
            <Card>
              <CardContent className="p-5">
                <p className="font-semibold mb-3">{t("revenue.dailySeries")}</p>
                <div className="flex flex-wrap gap-2">
                  {data.series.map((p) => (
                    <span
                      key={p.date}
                      className="text-xs rounded-full bg-primary/10 border border-primary/15 px-2.5 py-1"
                    >
                      {p.date}: {Math.round(p.commission).toLocaleString("fr-FR")} XOF
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
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
