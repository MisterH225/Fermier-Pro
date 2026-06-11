"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminRecalculateHybridPigPrice,
  adminUnfreezeHybridPigPrice,
  fetchAdminHybridPigPrice,
  type AdminHybridPigPriceDto
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Props = {
  token: string;
};

export function HybridPigPriceAdminSection({ token }: Props) {
  const t = useTranslations("pigPrice.hybrid");
  const tRoot = useTranslations("pigPrice");
  const [data, setData] = useState<AdminHybridPigPriceDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchAdminHybridPigPrice(token);
    setData(res);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onUnfreeze = async () => {
    setBusy(true);
    try {
      await adminUnfreezeHybridPigPrice(token);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onRecalculate = async () => {
    setBusy(true);
    try {
      await adminRecalculateHybridPigPrice(token);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <p className="text-muted-foreground text-sm">{tRoot("loading")}</p>;
  }

  const chartData = [...data.snapshots]
    .reverse()
    .map((s) => ({
      date: s.calculatedAt.slice(0, 16).replace("T", " "),
      value: s.indexValue,
      frozen: s.isFrozen
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={onRecalculate}>
              {t("recalculate")}
            </Button>
            {data.isFrozen ? (
              <Button size="sm" disabled={busy} onClick={onUnfreeze}>
                {t("unfreeze")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-2xl font-bold">
            {data.current?.price_per_kg != null
              ? `${Math.round(data.current.price_per_kg).toLocaleString("fr-FR")} FCFA/kg`
              : "—"}
          </p>
          {data.isFrozen ? (
            <p className="text-sm text-amber-800 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-3 py-2">
              {t("frozen", {
                reason: data.freezeReason ?? "circuit breaker"
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("active")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
              <YAxis tick={{ fontSize: 10 }} width={56} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("flagged")}</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto text-sm">
            {data.flaggedListings.length === 0 ? (
              <p className="text-muted-foreground">{t("none")}</p>
            ) : (
              <ul className="space-y-2">
                {data.flaggedListings.map((f) => (
                  <li key={f.id} className="border-b border-border/40 pb-2">
                    <span className="font-mono text-xs">{f.listingId.slice(0, 10)}…</span>
                    <br />
                    {t("deviation", {
                      price: Math.round(f.pricePerKg),
                      pct: f.deviationPct.toFixed(1)
                    })}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("contributors")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.topContributors.length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {data.topContributors.map((c) => (
                  <li key={c.sellerUserId} className="flex justify-between gap-2">
                    <span>{c.sellerName}</span>
                    <span className="text-muted-foreground">
                      {t("txCount", {
                        kg: Math.round(c.volumeKg),
                        count: c.transactionCount
                      })}
                    </span>
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
