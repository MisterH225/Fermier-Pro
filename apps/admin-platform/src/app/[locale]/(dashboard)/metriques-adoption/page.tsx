"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchAdoptionMetrics,
  type AdoptionMetricsDto,
  type AdoptionWindowMetricsDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { Card, CardContent } from "@/components/ui/card";

function CountTable({
  rows,
  colA,
  colB
}: {
  rows: Array<[string, number]>;
  colA: string;
  colB: string;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-3 font-medium">{colA}</th>
          <th className="py-2 font-medium">{colB}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-border/60">
            <td className="py-2 pr-3">{k}</td>
            <td className="py-2 tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function entries(map: Record<string, number>): Array<[string, number]> {
  return Object.entries(map).filter(([, n]) => n > 0);
}

function WindowPanel({
  title,
  data,
  t
}: {
  title: string;
  data: AdoptionWindowMetricsDto;
  t: (key: string) => string;
}) {
  const buyerRows = entries(data.profileCompletionBuckets.buyer);
  const vetRows = entries(data.profileCompletionBuckets.vet);
  const decisionRows = entries(data.offerDecisions.byDecision);
  const meteoRows = entries(data.offerDecisions.byMeteoLevel);
  const sourceRows = entries(data.vetBookingSources);
  const empty =
    buyerRows.length === 0 &&
    vetRows.length === 0 &&
    decisionRows.length === 0 &&
    sourceRows.length === 0 &&
    data.listingHealthBadge.samples === 0;

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {empty ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("profileBuckets")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("roleBuyer")}
              </p>
              <CountTable
                rows={buyerRows.length ? buyerRows : [["—", 0]]}
                colA={t("bucket")}
                colB={t("count")}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("roleVet")}
              </p>
              <CountTable
                rows={vetRows.length ? vetRows : [["—", 0]]}
                colA={t("bucket")}
                colB={t("count")}
              />
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("listingHealth")}</h3>
          <ul className="space-y-1 text-sm">
            <li>
              {t("samples")}:{" "}
              <span className="tabular-nums font-medium">
                {data.listingHealthBadge.samples}
              </span>
            </li>
            <li>
              {t("latestRatio")}:{" "}
              <span className="tabular-nums font-medium">
                {data.listingHealthBadge.latest
                  ? `${(data.listingHealthBadge.latest.ratio * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </li>
            <li>
              {t("avgRatio")}:{" "}
              <span className="tabular-nums font-medium">
                {data.listingHealthBadge.avgRatio != null
                  ? `${(data.listingHealthBadge.avgRatio * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </li>
            {data.listingHealthBadge.latest ? (
              <li className="text-muted-foreground">
                {t("latestDetail")}: {data.listingHealthBadge.latest.dayKey} —{" "}
                {data.listingHealthBadge.latest.badged}/
                {data.listingHealthBadge.latest.total}
              </li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("offerDecisions")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <CountTable
              rows={decisionRows.length ? decisionRows : [["—", 0]]}
              colA={t("decision")}
              colB={t("count")}
            />
            <CountTable
              rows={meteoRows.length ? meteoRows : [["—", 0]]}
              colA={t("meteoLevel")}
              colB={t("count")}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("vetBooking")}</h3>
          <CountTable
            rows={sourceRows.length ? sourceRows : [["—", 0]]}
            colA={t("source")}
            colB={t("count")}
          />
        </section>
      </CardContent>
    </Card>
  );
}

export default function AdoptionMetricsPage() {
  const t = useTranslations("adoption");
  const { token, ready } = useAdminToken();
  const [data, setData] = useState<AdoptionMetricsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !token) return;
    setLoading(true);
    setError(null);
    void fetchAdoptionMetrics(token)
      .then(setData)
      .catch(() => setError(t("loadError")))
      .finally(() => setLoading(false));
  }, [ready, token, t]);

  return (
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("pageLead")} />
      {loading ? (
        <p className="text-muted-foreground">…</p>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : data ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t("generatedAt", {
              date: new Date(data.generatedAt).toLocaleString()
            })}
          </p>
          <div className="grid gap-4 xl:grid-cols-2">
            <WindowPanel title={t("window7")} data={data.windows["7d"]} t={t} />
            <WindowPanel
              title={t("window30")}
              data={data.windows["30d"]}
              t={t}
            />
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
