"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  approveAdminMerchantProductResubmission,
  deleteAdminMerchantProduct,
  rejectAdminMerchantProductResubmission,
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

type StatusFilter =
  | "all"
  | "published"
  | "draft"
  | "disabled"
  | "moderated_removed"
  | "resubmission_review";

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "resubmission_review",
  "published",
  "draft",
  "disabled",
  "moderated_removed"
];

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const resubmissionCount = useMemo(
    () => rows.filter((r) => r.status === "resubmission_review").length,
    [rows]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

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

  const onApprove = async (row: AdminMerchantProductRow) => {
    setBusyId(row.id);
    try {
      await approveAdminMerchantProductResubmission(token, row.id);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (row: AdminMerchantProductRow) => {
    const reason = reasonById[row.id]?.trim();
    if (!reason) return;
    setBusyId(row.id);
    try {
      await rejectAdminMerchantProductResubmission(token, row.id, reason);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((id) => {
          const active = statusFilter === id;
          const label =
            id === "all"
              ? t("merchantProducts.filterAll")
              : t(`merchantProducts.status.${id}`, { defaultValue: id });
          const badge =
            id === "resubmission_review" && resubmissionCount > 0
              ? ` (${resubmissionCount})`
              : "";
          return (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
              {badge}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("merchantProducts.empty")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("merchantProducts.colProduct")}</TableHead>
                  <TableHead>{t("merchantProducts.colShop")}</TableHead>
                  <TableHead>{t("merchantProducts.colMerchant")}</TableHead>
                  <TableHead>{t("merchantProducts.colStatus")}</TableHead>
                  <TableHead className="text-right">
                    {t("merchantProducts.colPrice")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("merchantProducts.colStock")}
                  </TableHead>
                  <TableHead>{t("merchantProducts.colReason")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const isResubmission = row.status === "resubmission_review";
                  const canModerateRemove =
                    row.status !== "moderated_removed" && !isResubmission;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <div>{row.name}</div>
                        {isResubmission && row.resubmissionCount != null ? (
                          <div className="text-xs text-muted-foreground">
                            {t("merchantProducts.resubmissionMeta", {
                              count: row.resubmissionCount
                            })}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.shopName}</TableCell>
                      <TableCell className="text-sm">
                        {row.merchantName ?? row.merchantEmail ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            isResubmission
                              ? "text-amber-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          {t(`merchantProducts.status.${row.status}`, {
                            defaultValue: row.status
                          })}
                        </span>
                        {row.moderationReason && !isResubmission ? (
                          <div className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                            {row.moderationReason}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round(row.price).toLocaleString("fr-FR")} XOF
                      </TableCell>
                      <TableCell className="text-right">{row.stock}</TableCell>
                      <TableCell>
                        {(canModerateRemove || isResubmission) && (
                          <Input
                            value={reasonById[row.id] ?? ""}
                            placeholder={
                              isResubmission
                                ? t("merchantProducts.rejectReasonPlaceholder")
                                : t("merchantProducts.reasonPlaceholder")
                            }
                            onChange={(e) =>
                              setReasonById((prev) => ({
                                ...prev,
                                [row.id]: e.target.value
                              }))
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {isResubmission ? (
                            <>
                              <Button
                                size="sm"
                                disabled={busyId === row.id}
                                onClick={() => void onApprove(row)}
                              >
                                {t("merchantProducts.approveResubmission")}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={
                                  busyId === row.id ||
                                  !reasonById[row.id]?.trim()
                                }
                                onClick={() => void onReject(row)}
                              >
                                {t("merchantProducts.rejectResubmission")}
                              </Button>
                            </>
                          ) : null}
                          {canModerateRemove ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={
                                busyId === row.id ||
                                !reasonById[row.id]?.trim()
                              }
                              onClick={() => void onDelete(row)}
                            >
                              {t("merchantProducts.delete")}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
