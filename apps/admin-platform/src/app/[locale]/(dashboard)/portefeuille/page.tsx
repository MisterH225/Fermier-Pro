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
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <AdminSection
        icon={Wallet}
        title={t("pendingTitle")}
        description={t("pendingDesc")}
        bare
      >
        {loading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground shadow-sm">
            {t("empty")}
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3 text-sm">
                <p className="text-base font-semibold">
                  {row.user.displayName} — {row.amountToReceive.toLocaleString()} XOF
                </p>
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
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => void onApprove(row.id)}
                  >
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.id}
                    onClick={() => void onReject(row.id)}
                  >
                    {t("reject")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPageShell>
  );
}
