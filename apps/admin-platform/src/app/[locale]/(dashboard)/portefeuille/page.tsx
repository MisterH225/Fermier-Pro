"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  approveWithdrawalRequest,
  fetchPendingWithdrawals,
  rejectWithdrawalRequest,
  type WithdrawalRequestAdminDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function PortefeuilleAdminPage() {
  const t = useTranslations("walletAdmin");
  const { token, ready } = useAdminToken();
  const [rows, setRows] = useState<WithdrawalRequestAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchPendingWithdrawals(token);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onApprove = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await approveWithdrawalRequest(token, id);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await rejectWithdrawalRequest(token, id, rejectReason[id] ?? t("rejectDefault"));
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {loading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {row.user.displayName} — {row.amountToReceive.toLocaleString()} XOF
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                {t("phone")}: {row.phoneNumber}
              </p>
              <p>
                {t("fee")}: {row.feeAmount.toLocaleString()} XOF — {t("totalDebit")}:{" "}
                {row.totalDebit.toLocaleString()} XOF
              </p>
              <p className="text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </p>
              <Input
                placeholder={t("rejectPlaceholder")}
                value={rejectReason[row.id] ?? ""}
                onChange={(e) =>
                  setRejectReason((prev) => ({ ...prev, [row.id]: e.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button
                  disabled={busyId === row.id}
                  onClick={() => void onApprove(row.id)}
                >
                  {t("approve")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busyId === row.id}
                  onClick={() => void onReject(row.id)}
                >
                  {t("reject")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
