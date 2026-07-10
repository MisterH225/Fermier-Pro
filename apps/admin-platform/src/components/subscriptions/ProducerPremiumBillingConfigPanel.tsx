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

function pickProducerBilling(row: PlatformSettingsDto) {
  return {
    producerPremiumPriceXof: Number(row.producerPremiumPriceXof ?? 5000),
    producerPremiumBillingUnit: row.producerPremiumBillingUnit ?? "month",
    producerPremiumBillingInterval: Number(
      row.producerPremiumBillingInterval ?? 1
    ),
    producerPremiumGraceDays: Number(row.producerPremiumGraceDays ?? 7)
  } satisfies Partial<PlatformSettingsDto>;
}

export function ProducerPremiumBillingConfigPanel({
  token,
  canEdit,
  onSaved
}: Props) {
  const t = useTranslations("settings");
  const tPage = useTranslations("producerSubscriptions");
  const [form, setForm] = useState<Partial<PlatformSettingsDto> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const row = await fetchPlatformSettings(token);
      setForm(pickProducerBilling(row));
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
        pickProducerBilling(form as PlatformSettingsDto)
      );
      setForm(pickProducerBilling(next));
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
        {t("fields.producerPremiumSectionTitle")}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {tPage("configSectionHint")}
      </p>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="producer-premium-price">
            {t("fields.producerPremiumPriceXof")}
          </Label>
          <Input
            id="producer-premium-price"
            type="number"
            min={0}
            disabled={!canEdit}
            value={form.producerPremiumPriceXof ?? 5000}
            onChange={(e) =>
              update("producerPremiumPriceXof", Number(e.target.value) || 0)
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.producerPremiumPriceXofHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="producer-billing-unit">
            {t("fields.producerPremiumBillingUnit")}
          </Label>
          <select
            id="producer-billing-unit"
            className={selectClass}
            disabled={!canEdit}
            value={form.producerPremiumBillingUnit ?? "month"}
            onChange={(e) =>
              update(
                "producerPremiumBillingUnit",
                e.target.value as PlatformSettingsDto["producerPremiumBillingUnit"]
              )
            }
          >
            <option value="hour">{t("fields.billingUnitHour")}</option>
            <option value="day">{t("fields.billingUnitDay")}</option>
            <option value="month">{t("fields.billingUnitMonth")}</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {t("fields.producerPremiumBillingUnitHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="producer-billing-interval">
            {t("fields.producerPremiumBillingInterval")}
          </Label>
          <Input
            id="producer-billing-interval"
            type="number"
            min={1}
            max={365}
            disabled={!canEdit}
            value={form.producerPremiumBillingInterval ?? 1}
            onChange={(e) =>
              update(
                "producerPremiumBillingInterval",
                Number(e.target.value) || 1
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.producerPremiumBillingIntervalHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="producer-grace-days">
            {t("fields.producerPremiumGraceDays")}
          </Label>
          <Input
            id="producer-grace-days"
            type="number"
            min={0}
            max={365}
            disabled={!canEdit}
            value={form.producerPremiumGraceDays ?? 7}
            onChange={(e) =>
              update("producerPremiumGraceDays", Number(e.target.value) || 0)
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.producerPremiumGraceDaysHint")}
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
