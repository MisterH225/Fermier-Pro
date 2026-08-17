"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminRetrySettlement,
  type AdminIncompleteSettlementRow
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  rows: AdminIncompleteSettlementRow[];
  token: string;
  onRetried: () => void;
};

function money(v: number | null | undefined, currency: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} ${currency}`;
}

export function IncompleteSettlementsPanel({ rows, token, onRetried }: Props) {
  const t = useTranslations("marketplace");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("incompleteSettlements.empty")}
        </CardContent>
      </Card>
    );
  }

  const retry = async (transactionId: string) => {
    setBusyId(transactionId);
    setError(null);
    try {
      await adminRetrySettlement(token, transactionId);
      onRetried();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("incompleteSettlements.retryError")
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("incompleteSettlements.lead")}
      </p>
      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("transactions.colListing")}</TableHead>
                <TableHead>{t("transactions.colStatus")}</TableHead>
                <TableHead>{t("incompleteSettlements.colIssues")}</TableHead>
                <TableHead>{t("transactions.colBuyer")}</TableHead>
                <TableHead>{t("transactions.colSeller")}</TableHead>
                <TableHead className="text-right">
                  {t("transactions.colFinal")}
                </TableHead>
                <TableHead>{t("transactions.colUpdated")}</TableHead>
                <TableHead className="text-right">
                  {t("incompleteSettlements.colActions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium max-w-[180px] truncate">
                    {row.listing.title}
                    {row.isCredit ? (
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                        {t("transactions.creditBadge")}
                      </span>
                    ) : null}
                    <div className="text-[11px] text-muted-foreground font-normal">
                      {t("incompleteSettlements.listingStatus")}:{" "}
                      {row.listing.status}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`status.${row.status}`, { defaultValue: row.status })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ul className="space-y-1">
                      {row.issues.map((issue) => (
                        <li key={issue}>
                          <span className="inline-block rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            {t(`incompleteSettlements.issues.${issue}`, {
                              defaultValue: issue
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.buyer.fullName ?? row.buyer.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.seller.fullName ?? row.seller.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {money(row.finalAmount, row.currency)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.id}
                      onClick={() => void retry(row.id)}
                    >
                      {busyId === row.id
                        ? t("incompleteSettlements.retrying")
                        : t("incompleteSettlements.retry")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
