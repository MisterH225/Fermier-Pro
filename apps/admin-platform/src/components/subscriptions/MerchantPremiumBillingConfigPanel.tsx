"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchPlatformSettings,
  patchPlatformSettings,
  type PlatformSettingsDto
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/lib/ui-styles";

type Props = {
  token: string;
  canEdit: boolean;
  onSaved?: () => void;
};

function pickMerchantBilling(row: PlatformSettingsDto) {
  return {
    merchantPremiumPriceXof: Number(row.merchantPremiumPriceXof ?? 5000),
    merchantPremiumMaxShops: Number(row.merchantPremiumMaxShops ?? 3),
    merchantPremiumBillingUnit: row.merchantPremiumBillingUnit ?? "month",
    merchantPremiumBillingInterval: Number(
      row.merchantPremiumBillingInterval ?? 1
    ),
    merchantPremiumGraceDays: Number(row.merchantPremiumGraceDays ?? 7)
  } satisfies Partial<PlatformSettingsDto>;
}

export function MerchantPremiumBillingConfigPanel({
  token,
  canEdit,
  onSaved
}: Props) {
  const t = useTranslations("settings");
  const tPage = useTranslations("merchantSubscriptions");
  const [form, setForm] = useState<Partial<PlatformSettingsDto> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const row = await fetchPlatformSettings(token);
      setForm(pickMerchantBilling(row));
    } catch (e) {
      setError(e instanceof Error ? e.message : tPage("configLoadError"));
    }
  }, [token, tPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof PlatformSettingsDto>(
    key: K,
    value: PlatformSettingsDto[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const save = async () => {
    if (!form || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const next = await patchPlatformSettings(
        token,
        pickMerchantBilling(form as PlatformSettingsDto)
      );
      setForm(pickMerchantBilling(next));
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : tPage("configSaveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <section className="mb-8 rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          {error ?? tPage("configLoading")}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-lg border p-4">
      <h2 className="mb-1 text-base font-semibold">
        {t("fields.merchantPremiumSectionTitle")}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {tPage("configSectionHint")}
      </p>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="merchant-premium-price">
            {t("fields.merchantPremiumPriceXof")}
          </Label>
          <Input
            id="merchant-premium-price"
            type="number"
            min={0}
            step={100}
            disabled={!canEdit}
            value={form.merchantPremiumPriceXof ?? 5000}
            onChange={(e) =>
              update("merchantPremiumPriceXof", Number(e.target.value) || 0)
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.merchantPremiumPriceXofHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant-premium-shops">
            {t("fields.merchantPremiumMaxShops")}
          </Label>
          <Input
            id="merchant-premium-shops"
            type="number"
            min={1}
            max={50}
            disabled={!canEdit}
            value={form.merchantPremiumMaxShops ?? 3}
            onChange={(e) =>
              update("merchantPremiumMaxShops", Number(e.target.value) || 1)
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.merchantPremiumMaxShopsHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant-billing-unit">
            {t("fields.merchantPremiumBillingUnit")}
          </Label>
          <select
            id="merchant-billing-unit"
            className={selectClass}
            disabled={!canEdit}
            value={form.merchantPremiumBillingUnit ?? "month"}
            onChange={(e) =>
              update(
                "merchantPremiumBillingUnit",
                e.target.value as PlatformSettingsDto["merchantPremiumBillingUnit"]
              )
            }
          >
            <option value="hour">{t("fields.billingUnitHour")}</option>
            <option value="day">{t("fields.billingUnitDay")}</option>
            <option value="month">{t("fields.billingUnitMonth")}</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {t("fields.merchantPremiumBillingUnitHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant-billing-interval">
            {t("fields.merchantPremiumBillingInterval")}
          </Label>
          <Input
            id="merchant-billing-interval"
            type="number"
            min={1}
            max={365}
            disabled={!canEdit}
            value={form.merchantPremiumBillingInterval ?? 1}
            onChange={(e) =>
              update(
                "merchantPremiumBillingInterval",
                Number(e.target.value) || 1
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.merchantPremiumBillingIntervalHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant-grace-days">
            {t("fields.merchantPremiumGraceDays")}
          </Label>
          <Input
            id="merchant-grace-days"
            type="number"
            min={0}
            max={365}
            disabled={!canEdit}
            value={form.merchantPremiumGraceDays ?? 7}
            onChange={(e) =>
              update("merchantPremiumGraceDays", Number(e.target.value) || 0)
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.merchantPremiumGraceDaysHint")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          disabled={!canEdit || saving}
          onClick={() => void save()}
        >
          {saving ? tPage("configSaving") : tPage("configSave")}
        </Button>
        {saved ? (
          <span className="text-sm text-muted-foreground">
            {tPage("configSaved")}
          </span>
        ) : null}
      </div>
    </section>
  );
}
