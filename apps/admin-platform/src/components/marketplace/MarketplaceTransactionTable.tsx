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

function money(v: string | number, currency: string): string {
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} ${currency}`;
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
              <TableHead className="text-right">{t("transactions.colAmount")}</TableHead>
              <TableHead>{t("transactions.colUpdated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium max-w-[180px] truncate">
                  {row.listing.title}
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
