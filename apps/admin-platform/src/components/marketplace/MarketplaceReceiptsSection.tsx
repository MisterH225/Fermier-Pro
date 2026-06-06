"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminDownloadReceipt,
  adminRegenerateReceipt,
  fetchAdminMarketplaceReceipts,
  type AdminMarketplaceReceiptRow
} from "@/lib/api";
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
  token: string;
};

export function MarketplaceReceiptsSection({ token }: Props) {
  const t = useTranslations("marketplace.receipts");
  const [rows, setRows] = useState<AdminMarketplaceReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminMarketplaceReceipts(token);
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const regenerate = async (transactionId: string) => {
    setBusyId(transactionId);
    try {
      await adminRegenerateReceipt(token, transactionId);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const download = async (receiptId: string) => {
    setBusyId(receiptId);
    try {
      const res = await adminDownloadReceipt(token, receiptId);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  const generatedCount = rows.filter(
    (r) => r.receiptGenerationStatus === "generated"
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("summary", { total: rows.length, generated: generatedCount })}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colListing")}</TableHead>
            <TableHead>{t("colReceipt")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead>{t("colClosed")}</TableHead>
            <TableHead className="text-right">{t("colActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.transactionId}>
              <TableCell>{row.listingTitle}</TableCell>
              <TableCell>{row.receipt?.receiptNumber ?? "—"}</TableCell>
              <TableCell>{t(`status.${row.receiptGenerationStatus}`)}</TableCell>
              <TableCell>
                {row.closedAt
                  ? new Date(row.closedAt).toLocaleDateString("fr-FR")
                  : "—"}
              </TableCell>
              <TableCell className="text-right space-x-2">
                {row.receipt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.receipt.id}
                    onClick={() => void download(row.receipt!.id)}
                  >
                    {t("download")}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === row.transactionId}
                  onClick={() => void regenerate(row.transactionId)}
                >
                  {t("regenerate")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
