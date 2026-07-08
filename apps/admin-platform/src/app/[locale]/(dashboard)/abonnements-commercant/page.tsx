"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminApplyMerchantPromo,
  adminCancelMerchantSubscription,
  adminGrantMerchantTrial,
  adminResumeMerchantSubscription,
  adminSuspendMerchantSubscription,
  fetchAdminMerchantSubscriptions,
  type AdminMerchantSubscriptionRow,
  type AdminMerchantSubscriptionsListDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { useAdminAccess } from "@/lib/admin-access-context";
import { canWriteMenu } from "@/lib/admin-permissions";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectClass } from "@/lib/ui-styles";

export default function MerchantSubscriptionsPage() {
  const t = useTranslations("merchantSubscriptions");
  const { token, ready } = useAdminToken();
  const { profile } = useAdminAccess();
  const canWrite = canWriteMenu(profile, "merchantSubscriptions");
  const [data, setData] = useState<AdminMerchantSubscriptionsListDto | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetchAdminMerchantSubscriptions(token, {
        status: status || undefined,
        q: q.trim() || undefined
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    }
  }, [token, status, q, t]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  const run = async (
    profileId: string,
    action: () => Promise<AdminMerchantSubscriptionRow>
  ) => {
    if (!canWrite) return;
    setBusyId(profileId);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("actionError"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {data?.billing ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("billingSummary", {
            price: data.billing.effectivePriceXof,
            unit: t(`unit.${data.billing.billingUnit}`),
            interval: data.billing.billingInterval
          })}
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder={t("searchPh")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("statusAll")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="trialing">{t("status.trialing")}</option>
          <option value="past_due">{t("status.past_due")}</option>
          <option value="suspended">{t("status.suspended")}</option>
          <option value="cancelled">{t("status.cancelled")}</option>
        </select>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          {t("refresh")}
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3">{t("colMerchant")}</th>
              <th className="p-3">{t("colTier")}</th>
              <th className="p-3">{t("colStatus")}</th>
              <th className="p-3">{t("colNext")}</th>
              <th className="p-3">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.profileId} className="border-t">
                <td className="p-3">
                  <div className="font-medium">
                    {row.fullName || row.email || row.phone || row.userId}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.email}
                    {row.shopCount ? ` · ${row.shopCount} boutique(s)` : ""}
                  </div>
                </td>
                <td className="p-3">{row.subscriptionTier ?? "—"}</td>
                <td className="p-3">
                  {row.subscriptionStatus
                    ? t(`status.${row.subscriptionStatus}`)
                    : "—"}
                  {row.trialEndsAt ? (
                    <div className="text-xs text-muted-foreground">
                      {t("trialUntil", {
                        date: new Date(row.trialEndsAt).toLocaleString()
                      })}
                    </div>
                  ) : null}
                </td>
                <td className="p-3">
                  {row.nextBillingAt
                    ? new Date(row.nextBillingAt).toLocaleString()
                    : "—"}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {row.subscriptionStatus === "suspended" ? (
                      <Button
                        size="sm"
                        disabled={!canWrite || busyId === row.profileId}
                        onClick={() =>
                          void run(row.profileId, () =>
                            adminResumeMerchantSubscription(token!, row.profileId)
                          )
                        }
                      >
                        {t("resume")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          !canWrite ||
                          busyId === row.profileId ||
                          row.subscriptionTier !== "premium"
                        }
                        onClick={() =>
                          void run(row.profileId, () =>
                            adminSuspendMerchantSubscription(
                              token!,
                              row.profileId
                            )
                          )
                        }
                      >
                        {t("suspend")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={
                        !canWrite ||
                        busyId === row.profileId ||
                        row.subscriptionTier !== "premium"
                      }
                      onClick={() =>
                        void run(row.profileId, () =>
                          adminCancelMerchantSubscription(token!, row.profileId)
                        )
                      }
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canWrite || busyId === row.profileId}
                      onClick={() =>
                        void run(row.profileId, () =>
                          adminGrantMerchantTrial(token!, row.profileId)
                        )
                      }
                    >
                      {t("grantTrial")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canWrite || busyId === row.profileId}
                      onClick={() => {
                        const raw = window.prompt(t("promoPrompt"), "20");
                        if (raw == null) return;
                        const pct = Number(raw);
                        if (!Number.isFinite(pct)) return;
                        void run(row.profileId, () =>
                          adminApplyMerchantPromo(token!, row.profileId, pct)
                        );
                      }}
                    >
                      {t("applyPromo")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data?.items.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
