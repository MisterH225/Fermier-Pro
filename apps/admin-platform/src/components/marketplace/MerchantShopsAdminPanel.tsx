"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  archiveAdminMerchantShop,
  hardDeleteAdminMerchantShop,
  type AdminMerchantShopRow
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
  rows: AdminMerchantShopRow[];
  token: string;
  onRefresh: () => void;
};

export function MerchantShopsAdminPanel({ rows, token, onRefresh }: Props) {
  const t = useTranslations("marketplace");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const reasonOf = (id: string) => reasonById[id]?.trim() ?? "";

  const onArchive = async (row: AdminMerchantShopRow) => {
    const reason = reasonOf(row.id);
    if (!reason || row.archivedAt) return;
    setBusyId(row.id);
    try {
      await archiveAdminMerchantShop(token, row.id, reason);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const onHardDelete = async (row: AdminMerchantShopRow) => {
    const reason = reasonOf(row.id);
    if (!reason || row.hasOrderHistory) return;
    setBusyId(row.id);
    try {
      await hardDeleteAdminMerchantShop(token, row.id, reason);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("merchantShops.empty")}
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
              <TableHead>{t("merchantShops.colShop")}</TableHead>
              <TableHead>{t("merchantShops.colMerchant")}</TableHead>
              <TableHead className="text-right">
                {t("merchantShops.colProducts")}
              </TableHead>
              <TableHead className="text-right">
                {t("merchantShops.colOrders")}
              </TableHead>
              <TableHead>{t("merchantShops.colStatus")}</TableHead>
              <TableHead>{t("merchantShops.colReason")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const busy = busyId === row.id;
              const reason = reasonOf(row.id);
              const archived = Boolean(row.archivedAt);
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-sm">
                    {row.merchantName ?? row.merchantEmail ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{row.productCount}</TableCell>
                  <TableCell className="text-right">{row.orderCount}</TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {archived
                        ? t("merchantShops.statusArchived")
                        : t("merchantShops.statusActive")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={reasonById[row.id] ?? ""}
                      placeholder={t("merchantShops.reasonPlaceholder")}
                      onChange={(e) =>
                        setReasonById((prev) => ({
                          ...prev,
                          [row.id]: e.target.value
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || archived || !reason}
                        onClick={() => void onArchive(row)}
                        title={
                          archived
                            ? t("merchantShops.alreadyArchived")
                            : undefined
                        }
                      >
                        {t("merchantShops.archive")}
                      </Button>
                      <span
                        title={
                          row.hasOrderHistory
                            ? t("merchantShops.deleteDisabledTooltip")
                            : undefined
                        }
                      >
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy || row.hasOrderHistory || !reason}
                          onClick={() => void onHardDelete(row)}
                        >
                          {t("merchantShops.delete")}
                        </Button>
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
