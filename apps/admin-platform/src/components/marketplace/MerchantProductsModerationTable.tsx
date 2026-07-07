"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteAdminMerchantProduct,
  type AdminMerchantProductRow
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  rows: AdminMerchantProductRow[];
  token: string;
  onRefresh: () => void;
};

export function MerchantProductsModerationTable({
  rows,
  token,
  onRefresh
}: Props) {
  const t = useTranslations("marketplace");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const onDelete = async (row: AdminMerchantProductRow) => {
    const reason = reasonById[row.id]?.trim();
    if (!reason) return;
    setBusyId(row.id);
    try {
      await deleteAdminMerchantProduct(token, row.id, reason);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("merchantProducts.empty")}
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
              <TableHead>{t("merchantProducts.colProduct")}</TableHead>
              <TableHead>{t("merchantProducts.colShop")}</TableHead>
              <TableHead>{t("merchantProducts.colMerchant")}</TableHead>
              <TableHead>{t("merchantProducts.colStatus")}</TableHead>
              <TableHead className="text-right">{t("merchantProducts.colPrice")}</TableHead>
              <TableHead className="text-right">{t("merchantProducts.colStock")}</TableHead>
              <TableHead>{t("merchantProducts.colReason")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.shopName}</TableCell>
                <TableCell className="text-sm">
                  {row.merchantName ?? row.merchantEmail ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {Math.round(row.price).toLocaleString("fr-FR")} XOF
                </TableCell>
                <TableCell className="text-right">{row.stock}</TableCell>
                <TableCell>
                  <Input
                    value={reasonById[row.id] ?? ""}
                    placeholder={t("merchantProducts.reasonPlaceholder")}
                    onChange={(e) =>
                      setReasonById((prev) => ({
                        ...prev,
                        [row.id]: e.target.value
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId === row.id || !reasonById[row.id]?.trim()}
                    onClick={() => void onDelete(row)}
                  >
                    {t("merchantProducts.delete")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
