"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminMarketplaceListingRow } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { MarketplaceListingDetailDialog } from "./MarketplaceListingDetailDialog";

type Props = {
  rows: AdminMarketplaceListingRow[];
  token: string;
  onRefresh?: () => void;
};

function money(v: number | null, currency: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} ${currency}`;
}

export function MarketplaceListingsTable({ rows, token, onRefresh }: Props) {
  const t = useTranslations("marketplace");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("listings.empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("listings.colTitle")}</TableHead>
              <TableHead>{t("listings.colStatus")}</TableHead>
              <TableHead>{t("listings.colSeller")}</TableHead>
              <TableHead>{t("listings.colFarm")}</TableHead>
              <TableHead className="text-right">{t("listings.colPrice")}</TableHead>
              <TableHead className="text-right">{t("listings.colViews")}</TableHead>
              <TableHead className="text-right">{t("listings.colOffers")}</TableHead>
              <TableHead>{t("listings.colUpdated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-white/40"
                onClick={() => setSelectedId(row.id)}
              >
                <TableCell className="font-medium max-w-[200px]">
                  <p className="truncate">{row.title}</p>
                  {row.locationLabel ? (
                    <p className="text-xs text-muted-foreground truncate">
                      {row.locationLabel}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`listingStatus.${row.status}`, { defaultValue: row.status })}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {row.seller.fullName ?? row.seller.email ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{row.farm?.name ?? "—"}</TableCell>
                <TableCell className="text-right text-sm">
                  {money(row.totalPrice, row.currency)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {row.viewsCount.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {row.offerCount}
                  {row.activeOfferCount > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      ({row.activeOfferCount} {t("listings.active")})
                    </span>
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

    <MarketplaceListingDetailDialog
      token={token}
      listingId={selectedId}
      onClose={() => setSelectedId(null)}
      onDeleted={() => {
        setSelectedId(null);
        onRefresh?.();
      }}
    />
    </>
  );
}
