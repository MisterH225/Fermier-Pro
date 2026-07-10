"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchPlatformSettings,
  type PlatformSettingsDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountPasswordCard } from "@/components/settings/AccountPasswordCard";
import { InstitutionUsersManagementCard } from "@/components/settings/InstitutionUsersManagementCard";
import { useAdminAccess } from "@/lib/admin-access-context";
import { canWriteMenu } from "@/lib/admin-permissions";
import { AdminsManagementCard } from "@/components/settings/AdminsManagementCard";
import { WalletFeesPanel } from "@/components/settings/WalletFeesPanel";
import { PlatformSettingsPanel } from "@/components/settings/PlatformSettingsPanel";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSectionGroup } from "@/components/layout/AdminSection";

function normalizeSettingsRow(row: PlatformSettingsDto): PlatformSettingsDto {
  return {
    ...row,
    marketplaceCommissionRate: Number(row.marketplaceCommissionRate ?? 0.05),
    sellerMarketplaceCommissionRate: Number(
      row.sellerMarketplaceCommissionRate ?? 0.05
    ),
    vetCommissionRate: Number(row.vetCommissionRate ?? 0.05),
    withdrawalAutoApproveThreshold: Number(
      row.withdrawalAutoApproveThreshold ?? 50_000
    ),
    marketplaceWeightArbitrationMinDiffKg: Number(
      row.marketplaceWeightArbitrationMinDiffKg ?? 1
    ),
    marketplaceWeightArbitrationCumulativeMinDiffKg: Number(
      row.marketplaceWeightArbitrationCumulativeMinDiffKg ?? 5
    ),
    merchantPremiumPriceXof: Number(row.merchantPremiumPriceXof ?? 5000),
    merchantPremiumMaxShops: Number(row.merchantPremiumMaxShops ?? 3),
    merchantPremiumBillingUnit: row.merchantPremiumBillingUnit ?? "month",
    merchantPremiumBillingInterval: Number(
      row.merchantPremiumBillingInterval ?? 1
    ),
    merchantPremiumGraceDays: Number(row.merchantPremiumGraceDays ?? 7),
    merchantPremiumTrialEnabled: Boolean(row.merchantPremiumTrialEnabled),
    merchantPremiumTrialUnits: Number(row.merchantPremiumTrialUnits ?? 7),
    merchantPremiumPromoEnabled: Boolean(row.merchantPremiumPromoEnabled),
    merchantPremiumPromoPercentOff: Number(
      row.merchantPremiumPromoPercentOff ?? 20
    ),
    merchantPremiumPromoEndsAt: row.merchantPremiumPromoEndsAt ?? null,
    producerPremiumPriceXof: Number(row.producerPremiumPriceXof ?? 5000),
    producerPremiumBillingUnit: row.producerPremiumBillingUnit ?? "month",
    producerPremiumBillingInterval: Number(
      row.producerPremiumBillingInterval ?? 1
    ),
    producerPremiumGraceDays: Number(row.producerPremiumGraceDays ?? 7),
    producerPremiumTrialEnabled: Boolean(row.producerPremiumTrialEnabled),
    producerPremiumTrialUnits: Number(row.producerPremiumTrialUnits ?? 7),
    producerPremiumPromoEnabled: Boolean(row.producerPremiumPromoEnabled),
    producerPremiumPromoPercentOff: Number(
      row.producerPremiumPromoPercentOff ?? 20
    ),
    producerPremiumPromoEndsAt: row.producerPremiumPromoEndsAt ?? null
  };
}

export default function ParametresPage() {
  const t = useTranslations("settings");
  const { token, ready } = useAdminToken();
  const { profile } = useAdminAccess();
  const isSuperAdmin = profile?.role === "superadmin";
  const canEditSettings = canWriteMenu(profile, "settings");
  const [form, setForm] = useState<PlatformSettingsDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoadError(null);
    fetchPlatformSettings(token)
      .then((row) => setForm(normalizeSettingsRow(row)))
      .catch(() => {
        setLoadError(t("loadError"));
        setForm(null);
      });
  }, [token, t]);

  const update = <K extends keyof PlatformSettingsDto>(
    key: K,
    value: PlatformSettingsDto[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-4 max-w-5xl">
        <PageHeader title={t("title")} />
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      </div>
    );
  }

  if (!form || !token) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("pageLead")} />

      <AdminSectionGroup title={t("groups.access")}>
        <AccountPasswordCard />
        {isSuperAdmin ? <InstitutionUsersManagementCard /> : null}
        {isSuperAdmin ? <AdminsManagementCard /> : null}
      </AdminSectionGroup>

      <AdminSectionGroup title={t("groups.platform")}>
        <PlatformSettingsPanel
          token={token}
          form={form}
          canEdit={canEditSettings}
          onFormChange={setForm}
          update={update}
        />
        <WalletFeesPanel canEdit={canEditSettings} />
      </AdminSectionGroup>
    </AdminPageShell>
  );
}
