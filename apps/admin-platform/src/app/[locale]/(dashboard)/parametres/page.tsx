"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchPlatformSettings,
  patchPlatformSettings,
  type PlatformSettingsDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountPasswordCard } from "@/components/settings/AccountPasswordCard";
import { selectClass } from "@/lib/ui-styles";

const SCOPES = ["world", "africa", "west_africa", "countries"] as const;
const LEVELS = ["info", "warning", "critical"] as const;

export default function ParametresPage() {
  const t = useTranslations("settings");
  const { token, ready } = useAdminToken();
  const [form, setForm] = useState<PlatformSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchPlatformSettings(token).then((row) => {
      setForm({
        ...row,
        marketplaceCommissionRate: Number(row.marketplaceCommissionRate ?? 0.05)
      });
    });
  }, [token]);

  const update = <K extends keyof PlatformSettingsDto>(
    key: K,
    value: PlatformSettingsDto[K]
  ) => {
    setSaved(false);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onSave = async () => {
    if (!token || !form) return;
    setSaving(true);
    setSaved(false);
    try {
      const next = await patchPlatformSettings(token, {
        mapGeographicScope: form.mapGeographicScope,
        alertCaseThreshold: form.alertCaseThreshold,
        alertPeriodDays: form.alertPeriodDays,
        alertDefaultLevel: form.alertDefaultLevel,
        adminNotifyEmail: form.adminNotifyEmail ?? "",
        reportFrequencyDays: form.reportFrequencyDays,
        marketplaceCommissionRate: form.marketplaceCommissionRate
      });
      setForm(next);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !form) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title={t("title")} />

      <AccountPasswordCard />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("sections.map")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="map-scope">{t("fields.mapScope")}</Label>
            <select
              id="map-scope"
              value={form.mapGeographicScope}
              onChange={(e) => update("mapGeographicScope", e.target.value)}
              className={selectClass}
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {t(`scopes.${s}` as "scopes.world")}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("sections.alerts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alert-threshold">{t("fields.alertThreshold")}</Label>
            <Input
              id="alert-threshold"
              type="number"
              min={1}
              value={form.alertCaseThreshold}
              onChange={(e) => update("alertCaseThreshold", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-period">{t("fields.alertPeriod")}</Label>
            <Input
              id="alert-period"
              type="number"
              min={1}
              value={form.alertPeriodDays}
              onChange={(e) => update("alertPeriodDays", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-level">{t("fields.alertLevel")}</Label>
            <select
              id="alert-level"
              value={form.alertDefaultLevel}
              onChange={(e) => update("alertDefaultLevel", e.target.value)}
              className={selectClass}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`levels.${l}` as "levels.info")}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("sections.notifications")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">{t("fields.adminEmail")}</Label>
            <Input
              id="admin-email"
              type="email"
              value={form.adminNotifyEmail ?? ""}
              onChange={(e) => update("adminNotifyEmail", e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-frequency">{t("fields.reportFrequency")}</Label>
            <Input
              id="report-frequency"
              type="number"
              min={1}
              value={form.reportFrequencyDays}
              onChange={(e) => update("reportFrequencyDays", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("sections.marketplace")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="marketplace-commission">
              {t("fields.marketplaceCommission")}
            </Label>
            <Input
              id="marketplace-commission"
              type="number"
              min={0}
              max={99}
              step={0.1}
              value={Math.round((form.marketplaceCommissionRate ?? 0.05) * 1000) / 10}
              onChange={(e) => {
                const pct = Number(e.target.value);
                update(
                  "marketplaceCommissionRate",
                  Number.isFinite(pct) ? pct / 100 : 0.05
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.marketplaceCommissionHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? "…" : t("save")}
        </Button>
        {saved ? (
          <Badge variant="success">
            {t("saved")}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
