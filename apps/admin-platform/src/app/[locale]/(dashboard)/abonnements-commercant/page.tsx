"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminApplyMerchantPromo,
  adminCancelMerchantSubscription,
  adminCreateMerchantPromoCode,
  adminDeactivateMerchantPromoCode,
  adminGrantMerchantTrial,
  adminResumeMerchantSubscription,
  adminSuspendMerchantSubscription,
  adminTriggerMerchantRenewal,
  fetchAdminMerchantPromoCodes,
  fetchAdminMerchantSubscriptionInvoice,
  fetchAdminMerchantSubscriptionInvoices,
  fetchAdminMerchantSubscriptions,
  type AdminMerchantPromoCodeRow,
  type AdminMerchantSubscriptionInvoiceInspection,
  type AdminMerchantSubscriptionInvoiceRow,
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
import { MerchantPremiumBillingConfigPanel } from "@/components/subscriptions/MerchantPremiumBillingConfigPanel";

type PromoForm = {
  type: "trial" | "discount" | "promo";
  label: string;
  code: string;
  percentOff: string;
  trialUnits: string;
  maxRedemptions: string;
  expiresAt: string;
};

const emptyPromoForm = (): PromoForm => ({
  type: "discount",
  label: "",
  code: "",
  percentOff: "20",
  trialUnits: "7",
  maxRedemptions: "",
  expiresAt: ""
});

export default function MerchantSubscriptionsPage() {
  const t = useTranslations("merchantSubscriptions");
  const { token, ready } = useAdminToken();
  const { profile } = useAdminAccess();
  const canWrite = canWriteMenu(profile, "merchantSubscriptions");
  const [data, setData] = useState<AdminMerchantSubscriptionsListDto | null>(
    null
  );
  const [promoCodes, setPromoCodes] = useState<AdminMerchantPromoCodeRow[]>([]);
  const [promoForm, setPromoForm] = useState<PromoForm>(emptyPromoForm);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [invoiceQ, setInvoiceQ] = useState("");
  const [invoices, setInvoices] = useState<AdminMerchantSubscriptionInvoiceRow[]>(
    []
  );
  const [invoiceInspections, setInvoiceInspections] = useState<
    Record<string, AdminMerchantSubscriptionInvoiceInspection | "loading">
  >({});

  const loadInvoices = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchAdminMerchantSubscriptionInvoices(token, {
        status: invoiceStatus || undefined,
        q: invoiceQ.trim() || undefined
      });
      setInvoices(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invoicesLoadError"));
    }
  }, [token, invoiceStatus, invoiceQ, t]);

  const loadPromoCodes = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await fetchAdminMerchantPromoCodes(token);
      setPromoCodes(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("promoLoadError"));
    }
  }, [token, t]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetchAdminMerchantSubscriptions(token, {
        status: status || undefined,
        q: q.trim() || undefined
      });
      setData(res);
      await loadPromoCodes();
      await loadInvoices();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    }
  }, [token, status, q, t, loadPromoCodes, loadInvoices]);

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

  const verifyInvoice = async (invoiceId: string) => {
    if (!token) return;
    setInvoiceInspections((prev) => ({ ...prev, [invoiceId]: "loading" }));
    setError(null);
    try {
      const detail = await fetchAdminMerchantSubscriptionInvoice(
        token,
        invoiceId,
        true
      );
      if (detail.providerInspection) {
        setInvoiceInspections((prev) => ({
          ...prev,
          [invoiceId]: detail.providerInspection!
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invoiceVerifyError"));
      setInvoiceInspections((prev) => {
        const next = { ...prev };
        delete next[invoiceId];
        return next;
      });
    }
  };

  const createPromoCode = async () => {
    if (!token || !canWrite) return;
    setPromoBusy(true);
    setError(null);
    try {
      await adminCreateMerchantPromoCode(token, {
        type: promoForm.type,
        label: promoForm.label.trim() || undefined,
        code: promoForm.code.trim() || undefined,
        percentOff:
          promoForm.type === "trial"
            ? undefined
            : Number(promoForm.percentOff),
        trialUnits:
          promoForm.type === "trial"
            ? Number(promoForm.trialUnits)
            : undefined,
        maxRedemptions: promoForm.maxRedemptions.trim()
          ? Number(promoForm.maxRedemptions)
          : undefined,
        expiresAt: promoForm.expiresAt.trim() || undefined
      });
      setPromoForm(emptyPromoForm());
      await loadPromoCodes();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("promoCreateError"));
    } finally {
      setPromoBusy(false);
    }
  };

  const deactivatePromo = async (id: string) => {
    if (!token || !canWrite) return;
    setPromoBusy(true);
    setError(null);
    try {
      await adminDeactivateMerchantPromoCode(token, id);
      await loadPromoCodes();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("actionError"));
    } finally {
      setPromoBusy(false);
    }
  };

  return (
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {token ? (
        <MerchantPremiumBillingConfigPanel
          token={token}
          canEdit={canWrite}
          onSaved={() => void load()}
        />
      ) : null}
      {data?.billing ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("billingSummary", {
            price: data.billing.effectivePriceXof,
            unit: t(`unit.${data.billing.billingUnit}`),
            interval: data.billing.billingInterval
          })}
        </p>
      ) : null}

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-base font-semibold">{t("promoSectionTitle")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("promoSectionHint")}
        </p>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            className={selectClass}
            value={promoForm.type}
            onChange={(e) =>
              setPromoForm((f) => ({
                ...f,
                type: e.target.value as PromoForm["type"]
              }))
            }
          >
            <option value="trial">{t("promoType.trial")}</option>
            <option value="discount">{t("promoType.discount")}</option>
            <option value="promo">{t("promoType.promo")}</option>
          </select>
          <Input
            placeholder={t("promoLabelPh")}
            value={promoForm.label}
            onChange={(e) =>
              setPromoForm((f) => ({ ...f, label: e.target.value }))
            }
          />
          <Input
            placeholder={t("promoCodePh")}
            value={promoForm.code}
            onChange={(e) =>
              setPromoForm((f) => ({ ...f, code: e.target.value }))
            }
          />
          {promoForm.type === "trial" ? (
            <Input
              type="number"
              min={1}
              placeholder={t("promoTrialUnitsPh")}
              value={promoForm.trialUnits}
              onChange={(e) =>
                setPromoForm((f) => ({ ...f, trialUnits: e.target.value }))
              }
            />
          ) : (
            <Input
              type="number"
              min={1}
              max={100}
              placeholder={t("promoPercentPh")}
              value={promoForm.percentOff}
              onChange={(e) =>
                setPromoForm((f) => ({ ...f, percentOff: e.target.value }))
              }
            />
          )}
          <Input
            type="number"
            min={1}
            placeholder={t("promoMaxRedemptionsPh")}
            value={promoForm.maxRedemptions}
            onChange={(e) =>
              setPromoForm((f) => ({ ...f, maxRedemptions: e.target.value }))
            }
          />
          <Input
            type="datetime-local"
            value={promoForm.expiresAt}
            onChange={(e) =>
              setPromoForm((f) => ({ ...f, expiresAt: e.target.value }))
            }
          />
          <Button
            type="button"
            disabled={!canWrite || promoBusy}
            onClick={() => void createPromoCode()}
          >
            {t("promoCreate")}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3">{t("promoColCode")}</th>
                <th className="p-3">{t("promoColType")}</th>
                <th className="p-3">{t("promoColBenefit")}</th>
                <th className="p-3">{t("promoColUsage")}</th>
                <th className="p-3">{t("promoColStatus")}</th>
                <th className="p-3">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 font-mono font-medium">{row.code}</td>
                  <td className="p-3">{t(`promoType.${row.type}`)}</td>
                  <td className="p-3">
                    {row.type === "trial"
                      ? t("promoBenefitTrial", { units: row.trialUnits ?? 1 })
                      : t("promoBenefitPercent", {
                          percent: row.percentOff ?? 0
                        })}
                    {row.label ? (
                      <div className="text-xs text-muted-foreground">
                        {row.label}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {row.redemptionCount}
                    {row.maxRedemptions != null
                      ? ` / ${row.maxRedemptions}`
                      : ""}
                  </td>
                  <td className="p-3">
                    {row.isActive ? t("promoActive") : t("promoInactive")}
                  </td>
                  <td className="p-3">
                    {row.isActive ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canWrite || promoBusy}
                        onClick={() => void deactivatePromo(row.id)}
                      >
                        {t("promoDeactivate")}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {promoCodes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t("promoEmpty")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">{t("invoicesSectionTitle")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("invoicesSectionHint")}
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder={t("searchPh")}
            value={invoiceQ}
            onChange={(e) => setInvoiceQ(e.target.value)}
          />
          <select
            className={selectClass}
            value={invoiceStatus}
            onChange={(e) => setInvoiceStatus(e.target.value)}
          >
            <option value="">{t("invoiceStatusAll")}</option>
            <option value="pending">{t("invoiceStatus.pending")}</option>
            <option value="paid">{t("invoiceStatus.paid")}</option>
            <option value="failed">{t("invoiceStatus.failed")}</option>
            <option value="expired">{t("invoiceStatus.expired")}</option>
          </select>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadInvoices()}
          >
            {t("refresh")}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3">{t("invoiceColDate")}</th>
                <th className="p-3">{t("invoiceColMerchant")}</th>
                <th className="p-3">{t("invoiceColAmount")}</th>
                <th className="p-3">{t("invoiceColInvoiceStatus")}</th>
                <th className="p-3">{t("invoiceColProviderRef")}</th>
                <th className="p-3">{t("invoiceColProfile")}</th>
                <th className="p-3">{t("invoiceColPaidAt")}</th>
                <th className="p-3">{t("invoiceColActions")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((row) => {
                const inspection = invoiceInspections[row.invoiceId];
                return (
                  <Fragment key={row.invoiceId}>
                    <tr className="border-t align-top">
                      <td className="p-3 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                        <div className="text-xs text-muted-foreground">
                          {row.invoiceId}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">
                          {row.fullName || row.email || row.phone || row.userId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.phone}
                          {row.email ? ` · ${row.email}` : ""}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {row.amount.toLocaleString("fr-FR")} {row.currency}
                      </td>
                      <td className="p-3">{t(`invoiceStatus.${row.status}`)}</td>
                      <td className="p-3 max-w-[180px] break-all text-xs">
                        {row.providerRef ?? "—"}
                      </td>
                      <td className="p-3">
                        {row.profileSubscriptionTier ?? "—"}
                        {row.profileSubscriptionStatus ? (
                          <div className="text-xs text-muted-foreground">
                            {t(`status.${row.profileSubscriptionStatus}`)}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {row.paidAt
                          ? new Date(row.paidAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={inspection === "loading"}
                          onClick={() => void verifyInvoice(row.invoiceId)}
                        >
                          {inspection === "loading"
                            ? t("invoiceVerifying")
                            : t("invoiceVerify")}
                        </Button>
                      </td>
                    </tr>
                    {inspection && inspection !== "loading" ? (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={8} className="p-3 text-sm">
                          <p className="font-medium">
                            {t(`invoiceInsight.${inspection.syncInsight}`)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("invoiceInspectionCheckedAt", {
                              date: new Date(inspection.checkedAt).toLocaleString()
                            })}
                          </p>
                          {inspection.providerStatus ? (
                            <p className="mt-1 text-xs">
                              {t("invoiceInspectionProviderStatus", {
                                status: inspection.providerStatus
                              })}
                            </p>
                          ) : null}
                          {inspection.providerAmount != null ? (
                            <p className="text-xs">
                              {t("invoiceInspectionAmount", {
                                amount: inspection.providerAmount.toLocaleString(
                                  "fr-FR"
                                ),
                                currency: inspection.providerCurrency ?? "XOF"
                              })}
                            </p>
                          ) : null}
                          {inspection.lookupError ? (
                            <p className="mt-1 text-xs text-destructive">
                              {inspection.lookupError}
                            </p>
                          ) : null}
                          {inspection.geniusPayCheckoutUrl ? (
                            <a
                              className="mt-2 inline-block text-xs text-primary underline"
                              href={inspection.geniusPayCheckoutUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {inspection.geniusPayCheckoutUrl}
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {invoices.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t("invoicesEmpty")}
            </p>
          ) : null}
        </div>
      </section>

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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !canWrite ||
                        busyId === row.profileId ||
                        row.subscriptionTier !== "premium"
                      }
                      onClick={async () => {
                        if (!token || !canWrite) return;
                        setBusyId(row.profileId);
                        setError(null);
                        try {
                          const res = await adminTriggerMerchantRenewal(
                            token,
                            row.profileId
                          );
                          const msg = res.pendingInvoice?.paymentUrl
                            ? t("triggerRenewalOkWithLink", {
                                amount: res.pendingInvoice.amount
                              })
                            : t("triggerRenewalOk");
                          window.alert(msg);
                          await load();
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : t("actionError")
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      {t("triggerRenewal")}
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
