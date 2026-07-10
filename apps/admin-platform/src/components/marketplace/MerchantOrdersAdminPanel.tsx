"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  resolveAdminMerchantOrderDispute,
  type AdminMerchantOrderRow
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { selectClass } from "@/lib/ui-styles";

type Props = {
  token: string;
  rows: AdminMerchantOrderRow[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onReload: () => void;
};

const STATUS_FILTERS = [
  "all",
  "disputed",
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "completed",
  "refunded"
] as const;

export function MerchantOrdersAdminPanel({
  token,
  rows,
  statusFilter,
  onStatusFilterChange,
  onReload
}: Props) {
  const t = useTranslations("marketplace");
  const [selected, setSelected] = useState<AdminMerchantOrderRow | null>(null);
  const [decision, setDecision] = useState<"buyer" | "seller">("buyer");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disputedCount = useMemo(
    () => rows.filter((r) => r.status === "disputed").length,
    [rows]
  );

  const openResolve = (row: AdminMerchantOrderRow) => {
    setSelected(row);
    setDecision("buyer");
    setNote("");
    setError(null);
  };

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await resolveAdminMerchantOrderDispute(token, selected.id, {
        decision,
        note: note.trim() || undefined
      });
      setSelected(null);
      onReload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("merchantOrders.resolveError")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={selectClass}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          {STATUS_FILTERS.map((id) => (
            <option key={id} value={id}>
              {id === "all"
                ? t("merchantOrders.allStatuses")
                : t(`merchantOrders.status.${id}`, { defaultValue: id })}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          {t("merchantOrders.disputedCount", { count: disputedCount })}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("merchantOrders.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => (
            <Card
              key={row.id}
              className={
                row.status === "disputed"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : undefined
              }
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">
                      {row.productName ?? row.productId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      #{row.id.slice(-8).toUpperCase()} ·{" "}
                      {t(`merchantOrders.status.${row.status}`, {
                        defaultValue: row.status
                      })}
                      {row.escrowHeld ? ` · ${t("merchantOrders.escrowHeld")}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("merchantOrders.buyer")}:{" "}
                      {row.buyerName ?? row.buyerUserId} ·{" "}
                      {t("merchantOrders.seller")}:{" "}
                      {row.sellerName ?? row.sellerUserId}
                    </p>
                  </div>
                  {row.status === "disputed" ? (
                    <Button onClick={() => openResolve(row)}>
                      {t("merchantOrders.resolve")}
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-2xl border bg-white/50 p-3">
                    <p className="text-muted-foreground">
                      {t("merchantOrders.amount")}
                    </p>
                    <p className="font-semibold">
                      {row.totalAmount.toLocaleString("fr-FR")}{" "}
                      {row.productCurrency}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-white/50 p-3">
                    <p className="text-muted-foreground">
                      {t("merchantOrders.qty")}
                    </p>
                    <p className="font-semibold">{row.quantity}</p>
                  </div>
                  <div className="rounded-2xl border bg-white/50 p-3">
                    <p className="text-muted-foreground">
                      {t("merchantOrders.createdAt")}
                    </p>
                    <p className="font-semibold">
                      {new Date(row.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>

                {row.dispute ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-50/80 p-3 text-sm">
                    <p className="font-semibold text-amber-900">
                      {t("merchantOrders.disputeReason")}
                    </p>
                    <p className="text-amber-950">{row.dispute.reason}</p>
                    {row.dispute.buyerNote ? (
                      <p className="mt-2 text-muted-foreground">
                        {t("merchantOrders.buyerNote")}: {row.dispute.buyerNote}
                      </p>
                    ) : null}
                    {row.dispute.sellerNote ? (
                      <p className="text-muted-foreground">
                        {t("merchantOrders.sellerNote")}: {row.dispute.sellerNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("merchantOrders.resolveTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="decision">{t("merchantOrders.decision")}</Label>
              <select
                id="decision"
                className={selectClass}
                value={decision}
                onChange={(e) =>
                  setDecision(e.target.value as "buyer" | "seller")
                }
              >
                <option value="buyer">{t("merchantOrders.decisionBuyer")}</option>
                <option value="seller">
                  {t("merchantOrders.decisionSeller")}
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">{t("merchantOrders.note")}</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("merchantOrders.notePlaceholder")}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={submitting}
            >
              {t("merchantOrders.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting
                ? t("merchantOrders.resolving")
                : t("merchantOrders.confirmResolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
