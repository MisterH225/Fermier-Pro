"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminArbitrateMarketplaceWeight,
  type AdminMarketplaceTransactionRow
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type Props = {
  token: string;
  rows: AdminMarketplaceTransactionRow[];
  onReload: () => void;
};

function num(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "—";
}

export function WeightDisputeQueue({ token, rows, onReload }: Props) {
  const t = useTranslations("marketplace");
  const [selected, setSelected] = useState<AdminMarketplaceTransactionRow | null>(
    null
  );
  const [weight, setWeight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openArbitrate = (row: AdminMarketplaceTransactionRow) => {
    setSelected(row);
    setWeight(
      row.realWeightKg != null ? String(num(row.realWeightKg)).replace(/\s/g, "") : ""
    );
    setError(null);
  };

  const submit = async () => {
    if (!selected) return;
    const kg = Number.parseFloat(weight.replace(",", "."));
    if (!Number.isFinite(kg) || kg <= 0) {
      setError(t("disputes.invalidWeight"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await adminArbitrateMarketplaceWeight(token, selected.id, kg);
      setSelected(null);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("disputes.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("disputes.empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {rows.map((row) => (
          <Card key={row.id} className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap gap-3 items-start justify-between">
                <div>
                  <p className="font-bold text-lg">{row.listing.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("disputes.buyer")}: {row.buyer.fullName ?? row.buyer.email} ·{" "}
                    {t("disputes.seller")}: {row.seller.fullName ?? row.seller.email}
                  </p>
                </div>
                <Button onClick={() => openArbitrate(row)}>
                  {t("disputes.arbitrate")}
                </Button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-sm p-3">
                  <p className="text-muted-foreground">{t("disputes.declaredWeight")}</p>
                  <p className="font-semibold">{num(row.realWeightKg)} kg</p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-sm p-3">
                  <p className="text-muted-foreground">{t("disputes.blockedAmount")}</p>
                  <p className="font-semibold">
                    {num(row.blockedAmount)} {row.currency}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-sm p-3">
                  <p className="text-muted-foreground">{t("disputes.openedAt")}</p>
                  <p className="font-semibold">
                    {row.weightDisputeOpenedAt
                      ? new Date(row.weightDisputeOpenedAt).toLocaleString("fr-FR")
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disputes.arbitrateTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selected?.listing.title}
          </p>
          <label className="text-sm font-medium">{t("disputes.arbitrationWeight")}</label>
          <Input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0,0"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {t("disputes.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? "…" : t("disputes.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
