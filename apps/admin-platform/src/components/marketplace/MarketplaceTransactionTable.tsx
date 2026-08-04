"use client";

import { useTranslations } from "next-intl";
import type { AdminMarketplaceTransactionRow } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  rows: AdminMarketplaceTransactionRow[];
};

function money(v: string | number | null | undefined, currency: string): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} ${currency}`;
}

function kg(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
}

export function MarketplaceTransactionTable({ rows }: Props) {
  const t = useTranslations("marketplace");

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("transactions.empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("transactions.colListing")}</TableHead>
              <TableHead>{t("transactions.colStatus")}</TableHead>
              <TableHead>{t("transactions.colBuyer")}</TableHead>
              <TableHead>{t("transactions.colSeller")}</TableHead>
              <TableHead className="text-right">{t("transactions.colBlocked")}</TableHead>
              <TableHead className="text-right">{t("transactions.colFinal")}</TableHead>
              <TableHead className="text-right">{t("transactions.colSellerPaid")}</TableHead>
              <TableHead className="text-right">{t("transactions.colBuyerRefund")}</TableHead>
              <TableHead className="text-right">{t("transactions.colCommission")}</TableHead>
              <TableHead>{t("transactions.colWeights")}</TableHead>
              <TableHead>{t("transactions.colUpdated")}</TableHead>
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
                </TableCell>
                <TableCell>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`status.${row.status}`, { defaultValue: row.status })}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {row.buyer.fullName ?? row.buyer.email ?? "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.seller.fullName ?? row.seller.email ?? "—"}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {money(row.blockedAmount, row.currency)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {money(row.finalAmount, row.currency)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {money(row.sellerReceivedAmount, row.currency)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {money(row.buyerRefundAmount, row.currency)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {money(row.commissionAmount, row.currency)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  <div>
                    {t("transactions.weightEst")}: {kg(row.estimatedWeightKg)}
                  </div>
                  <div>
                    {t("transactions.weightReal")}: {kg(row.realWeightKg)}
                  </div>
                  {row.arbitrationWeightKg != null ? (
                    <div>
                      {t("transactions.weightArb")}: {kg(row.arbitrationWeightKg)}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(row.updatedAt).toLocaleString("fr-FR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
