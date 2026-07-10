"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Bell,
  Headphones,
  MapPin,
  ShoppingBag,
  Stethoscope,
  Wallet
} from "lucide-react";
import {
  patchPlatformSettings,
  type PlatformSettingsDto
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/lib/ui-styles";
import {
  AdminSection,
  AdminSectionSaveFooter
} from "@/components/layout/AdminSection";

const SCOPES = ["world", "africa", "west_africa", "countries"] as const;
const LEVELS = ["info", "warning", "critical"] as const;

type SectionKey =
  | "support"
  | "map"
  | "alerts"
  | "notifications"
  | "marketplace"
  | "vet"
  | "wallet";

type Props = {
  token: string;
  form: PlatformSettingsDto;
  canEdit: boolean;
  onFormChange: (next: PlatformSettingsDto) => void;
  update: <K extends keyof PlatformSettingsDto>(
    key: K,
    value: PlatformSettingsDto[K]
  ) => void;
};

export function PlatformSettingsPanel({
  token,
  form,
  canEdit,
  onFormChange,
  update
}: Props) {
  const t = useTranslations("settings");
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [saved, setSaved] = useState<Partial<Record<SectionKey, boolean>>>({});

  const saveSection = useCallback(
    async (key: SectionKey, body: Partial<PlatformSettingsDto>) => {
      setSaving(key);
      setSaved((prev) => ({ ...prev, [key]: false }));
      try {
        const next = await patchPlatformSettings(token, body);
        onFormChange({
          ...next,
          marketplaceCommissionRate: Number(next.marketplaceCommissionRate ?? 0.05),
          sellerMarketplaceCommissionRate: Number(
            next.sellerMarketplaceCommissionRate ?? 0.05
          ),
          vetCommissionRate: Number(next.vetCommissionRate ?? 0.05),
          withdrawalAutoApproveThreshold: Number(
            next.withdrawalAutoApproveThreshold ?? 50_000
          ),
          marketplaceWeightArbitrationMinDiffKg: Number(
            next.marketplaceWeightArbitrationMinDiffKg ?? 1
          ),
          marketplaceWeightArbitrationCumulativeMinDiffKg: Number(
            next.marketplaceWeightArbitrationCumulativeMinDiffKg ?? 5
          ),
          merchantPremiumPriceXof: Number(next.merchantPremiumPriceXof ?? 5000),
          merchantPremiumMaxShops: Number(next.merchantPremiumMaxShops ?? 3),
          merchantPremiumBillingUnit: next.merchantPremiumBillingUnit ?? "month",
          merchantPremiumBillingInterval: Number(
            next.merchantPremiumBillingInterval ?? 1
          ),
          merchantPremiumGraceDays: Number(next.merchantPremiumGraceDays ?? 7),
          merchantPremiumTrialEnabled: Boolean(next.merchantPremiumTrialEnabled),
          merchantPremiumTrialUnits: Number(next.merchantPremiumTrialUnits ?? 7),
          merchantPremiumPromoEnabled: Boolean(next.merchantPremiumPromoEnabled),
          merchantPremiumPromoPercentOff: Number(
            next.merchantPremiumPromoPercentOff ?? 20
          ),
          merchantPremiumPromoEndsAt: next.merchantPremiumPromoEndsAt ?? null,
          producerPremiumPriceXof: Number(next.producerPremiumPriceXof ?? 5000),
          producerPremiumBillingUnit: next.producerPremiumBillingUnit ?? "month",
          producerPremiumBillingInterval: Number(
            next.producerPremiumBillingInterval ?? 1
          ),
          producerPremiumGraceDays: Number(next.producerPremiumGraceDays ?? 7),
          producerPremiumTrialEnabled: Boolean(next.producerPremiumTrialEnabled),
          producerPremiumTrialUnits: Number(next.producerPremiumTrialUnits ?? 7),
          producerPremiumPromoEnabled: Boolean(next.producerPremiumPromoEnabled),
          producerPremiumPromoPercentOff: Number(
            next.producerPremiumPromoPercentOff ?? 20
          ),
          producerPremiumPromoEndsAt: next.producerPremiumPromoEndsAt ?? null
        });
        setSaved((prev) => ({ ...prev, [key]: true }));
      } finally {
        setSaving(null);
      }
    },
    [token, onFormChange]
  );

  const footer = (key: SectionKey) => (
    <AdminSectionSaveFooter
      canEdit={canEdit}
      saving={saving === key}
      saved={saved[key]}
      saveLabel={t("save")}
      savedLabel={t("saved")}
      onSave={() => {
        switch (key) {
          case "support":
            void saveSection("support", {
              supportPhone: form.supportPhone ?? "",
              supportTelegramUrl: form.supportTelegramUrl ?? ""
            });
            break;
          case "map":
            void saveSection("map", {
              mapGeographicScope: form.mapGeographicScope
            });
            break;
          case "alerts":
            void saveSection("alerts", {
              alertCaseThreshold: form.alertCaseThreshold,
              alertPeriodDays: form.alertPeriodDays,
              alertDefaultLevel: form.alertDefaultLevel
            });
            break;
          case "notifications":
            void saveSection("notifications", {
              adminNotifyEmail: form.adminNotifyEmail ?? "",
              reportFrequencyDays: form.reportFrequencyDays
            });
            break;
          case "marketplace":
            void saveSection("marketplace", {
              marketplaceCommissionRate: form.marketplaceCommissionRate,
              sellerMarketplaceCommissionRate: form.sellerMarketplaceCommissionRate,
              marketplaceWeightArbitrationMinDiffKg:
                form.marketplaceWeightArbitrationMinDiffKg ?? 1,
              marketplaceWeightArbitrationCumulativeMinDiffKg:
                form.marketplaceWeightArbitrationCumulativeMinDiffKg ?? 5,
              merchantPremiumPriceXof: form.merchantPremiumPriceXof ?? 5000,
              merchantPremiumMaxShops: form.merchantPremiumMaxShops ?? 3,
              merchantPremiumBillingUnit: form.merchantPremiumBillingUnit ?? "month",
              merchantPremiumBillingInterval:
                form.merchantPremiumBillingInterval ?? 1,
              merchantPremiumGraceDays: form.merchantPremiumGraceDays ?? 7,
              merchantPremiumTrialEnabled: Boolean(
                form.merchantPremiumTrialEnabled
              ),
              merchantPremiumTrialUnits: form.merchantPremiumTrialUnits ?? 7,
              merchantPremiumPromoEnabled: Boolean(
                form.merchantPremiumPromoEnabled
              ),
              merchantPremiumPromoPercentOff:
                form.merchantPremiumPromoPercentOff ?? 20,
              merchantPremiumPromoEndsAt: form.merchantPremiumPromoEndsAt ?? null,
              producerPremiumPriceXof: form.producerPremiumPriceXof ?? 5000,
              producerPremiumBillingUnit: form.producerPremiumBillingUnit ?? "month",
              producerPremiumBillingInterval:
                form.producerPremiumBillingInterval ?? 1,
              producerPremiumGraceDays: form.producerPremiumGraceDays ?? 7,
              producerPremiumTrialEnabled: Boolean(
                form.producerPremiumTrialEnabled
              ),
              producerPremiumTrialUnits: form.producerPremiumTrialUnits ?? 7,
              producerPremiumPromoEnabled: Boolean(
                form.producerPremiumPromoEnabled
              ),
              producerPremiumPromoPercentOff:
                form.producerPremiumPromoPercentOff ?? 20,
              producerPremiumPromoEndsAt: form.producerPremiumPromoEndsAt ?? null
            });
            break;
          case "vet":
            void saveSection("vet", {
              vetCommissionRate: form.vetCommissionRate
            });
            break;
          case "wallet":
            void saveSection("wallet", {
              withdrawalAutoApproveThreshold:
                form.withdrawalAutoApproveThreshold ?? 50_000
            });
            break;
        }
      }}
    />
  );

  return (
    <>
      <AdminSection
        id="support"
        icon={Headphones}
        title={t("sections.support")}
        description={t("sections.supportDesc")}
        footer={footer("support")}
      >
        <div className="space-y-2">
          <Label htmlFor="support-phone">{t("fields.supportPhone")}</Label>
          <Input
            id="support-phone"
            type="tel"
            placeholder="+221771234567"
            value={form.supportPhone ?? ""}
            disabled={!canEdit}
            onChange={(e) => update("supportPhone", e.target.value || null)}
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.supportPhoneHint")}
          </p>
          {!form.supportPhone?.trim() && form.supportEffective?.phone ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("fields.supportPhoneEffective", {
                value: form.supportEffective.phone
              })}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-telegram">{t("fields.supportTelegram")}</Label>
          <Input
            id="support-telegram"
            type="url"
            placeholder="https://t.me/fermierpro ou @fermierpro"
            value={form.supportTelegramUrl ?? ""}
            disabled={!canEdit}
            onChange={(e) => update("supportTelegramUrl", e.target.value || null)}
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.supportTelegramHint")}
          </p>
          {!form.supportTelegramUrl?.trim() && form.supportEffective?.telegramUrl ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("fields.supportTelegramEffective", {
                value: form.supportEffective.telegramUrl
              })}
            </p>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection
        id="map"
        icon={MapPin}
        title={t("sections.map")}
        description={t("sections.mapDesc")}
        footer={footer("map")}
      >
        <div className="space-y-2">
          <Label htmlFor="map-scope">{t("fields.mapScope")}</Label>
          <select
            id="map-scope"
            value={form.mapGeographicScope}
            disabled={!canEdit}
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
      </AdminSection>

      <AdminSection
        id="alerts"
        icon={AlertTriangle}
        title={t("sections.alerts")}
        description={t("sections.alertsDesc")}
        footer={footer("alerts")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alert-threshold">{t("fields.alertThreshold")}</Label>
            <Input
              id="alert-threshold"
              type="number"
              min={1}
              disabled={!canEdit}
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
              disabled={!canEdit}
              value={form.alertPeriodDays}
              onChange={(e) => update("alertPeriodDays", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="alert-level">{t("fields.alertLevel")}</Label>
          <select
            id="alert-level"
            value={form.alertDefaultLevel}
            disabled={!canEdit}
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
      </AdminSection>

      <AdminSection
        id="notifications"
        icon={Bell}
        title={t("sections.notifications")}
        description={t("sections.notificationsDesc")}
        footer={footer("notifications")}
      >
        <div className="space-y-2">
          <Label htmlFor="admin-email">{t("fields.adminEmail")}</Label>
          <Input
            id="admin-email"
            type="email"
            disabled={!canEdit}
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
            disabled={!canEdit}
            value={form.reportFrequencyDays}
            onChange={(e) => update("reportFrequencyDays", Number(e.target.value))}
          />
        </div>
      </AdminSection>

      <AdminSection
        id="marketplace"
        icon={ShoppingBag}
        title={t("sections.marketplace")}
        description={t("sections.marketplaceDesc")}
        footer={footer("marketplace")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
              disabled={!canEdit}
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
          <div className="space-y-2">
            <Label htmlFor="seller-commission">
              {t("fields.sellerMarketplaceCommission")}
            </Label>
            <Input
              id="seller-commission"
              type="number"
              min={0}
              max={99}
              step={0.1}
              disabled={!canEdit}
              value={
                Math.round((form.sellerMarketplaceCommissionRate ?? 0.05) * 1000) /
                10
              }
              onChange={(e) => {
                const pct = Number(e.target.value);
                update(
                  "sellerMarketplaceCommissionRate",
                  Number.isFinite(pct) ? pct / 100 : 0.05
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.sellerMarketplaceCommissionHint")}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="weight-arbitration-min">
              {t("fields.weightArbitrationMinDiffKg")}
            </Label>
            <Input
              id="weight-arbitration-min"
              type="number"
              min={0}
              step={0.1}
              disabled={!canEdit}
              value={form.marketplaceWeightArbitrationMinDiffKg ?? 1}
              onChange={(e) =>
                update(
                  "marketplaceWeightArbitrationMinDiffKg",
                  Number(e.target.value) || 0
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.weightArbitrationMinDiffKgHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight-arbitration-cumulative">
              {t("fields.weightArbitrationCumulativeMinDiffKg")}
            </Label>
            <Input
              id="weight-arbitration-cumulative"
              type="number"
              min={0}
              step={0.1}
              disabled={!canEdit}
              value={form.marketplaceWeightArbitrationCumulativeMinDiffKg ?? 5}
              onChange={(e) =>
                update(
                  "marketplaceWeightArbitrationCumulativeMinDiffKg",
                  Number(e.target.value) || 0
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.weightArbitrationCumulativeMinDiffKgHint")}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm font-semibold sm:col-span-2">
            {t("fields.merchantPremiumSectionTitle")}
          </p>
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="merchant-trial-enabled">
              {t("fields.merchantPremiumTrialEnabled")}
            </Label>
            <select
              id="merchant-trial-enabled"
              className={selectClass}
              disabled={!canEdit}
              value={form.merchantPremiumTrialEnabled ? "1" : "0"}
              onChange={(e) =>
                update("merchantPremiumTrialEnabled", e.target.value === "1")
              }
            >
              <option value="0">{t("fields.no")}</option>
              <option value="1">{t("fields.yes")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-trial-units">
              {t("fields.merchantPremiumTrialUnits")}
            </Label>
            <Input
              id="merchant-trial-units"
              type="number"
              min={1}
              max={365}
              disabled={!canEdit}
              value={form.merchantPremiumTrialUnits ?? 7}
              onChange={(e) =>
                update("merchantPremiumTrialUnits", Number(e.target.value) || 1)
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.merchantPremiumTrialUnitsHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-promo-enabled">
              {t("fields.merchantPremiumPromoEnabled")}
            </Label>
            <select
              id="merchant-promo-enabled"
              className={selectClass}
              disabled={!canEdit}
              value={form.merchantPremiumPromoEnabled ? "1" : "0"}
              onChange={(e) =>
                update("merchantPremiumPromoEnabled", e.target.value === "1")
              }
            >
              <option value="0">{t("fields.no")}</option>
              <option value="1">{t("fields.yes")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-promo-pct">
              {t("fields.merchantPremiumPromoPercentOff")}
            </Label>
            <Input
              id="merchant-promo-pct"
              type="number"
              min={0}
              max={100}
              disabled={!canEdit}
              value={form.merchantPremiumPromoPercentOff ?? 20}
              onChange={(e) =>
                update(
                  "merchantPremiumPromoPercentOff",
                  Number(e.target.value) || 0
                )
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="merchant-promo-ends">
              {t("fields.merchantPremiumPromoEndsAt")}
            </Label>
            <Input
              id="merchant-promo-ends"
              type="datetime-local"
              disabled={!canEdit}
              value={
                form.merchantPremiumPromoEndsAt
                  ? form.merchantPremiumPromoEndsAt.slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                update(
                  "merchantPremiumPromoEndsAt",
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null
                )
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 border-t pt-6 mt-2">
          <p className="text-sm font-semibold sm:col-span-2">
            {t("fields.producerPremiumSectionTitle")}
          </p>
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
          <div className="space-y-2">
            <Label htmlFor="producer-trial-enabled">
              {t("fields.producerPremiumTrialEnabled")}
            </Label>
            <select
              id="producer-trial-enabled"
              className={selectClass}
              disabled={!canEdit}
              value={form.producerPremiumTrialEnabled ? "1" : "0"}
              onChange={(e) =>
                update("producerPremiumTrialEnabled", e.target.value === "1")
              }
            >
              <option value="0">{t("fields.no")}</option>
              <option value="1">{t("fields.yes")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="producer-trial-units">
              {t("fields.producerPremiumTrialUnits")}
            </Label>
            <Input
              id="producer-trial-units"
              type="number"
              min={1}
              max={365}
              disabled={!canEdit}
              value={form.producerPremiumTrialUnits ?? 7}
              onChange={(e) =>
                update("producerPremiumTrialUnits", Number(e.target.value) || 1)
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.producerPremiumTrialUnitsHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="producer-promo-enabled">
              {t("fields.producerPremiumPromoEnabled")}
            </Label>
            <select
              id="producer-promo-enabled"
              className={selectClass}
              disabled={!canEdit}
              value={form.producerPremiumPromoEnabled ? "1" : "0"}
              onChange={(e) =>
                update("producerPremiumPromoEnabled", e.target.value === "1")
              }
            >
              <option value="0">{t("fields.no")}</option>
              <option value="1">{t("fields.yes")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="producer-promo-pct">
              {t("fields.producerPremiumPromoPercentOff")}
            </Label>
            <Input
              id="producer-promo-pct"
              type="number"
              min={0}
              max={100}
              disabled={!canEdit}
              value={form.producerPremiumPromoPercentOff ?? 20}
              onChange={(e) =>
                update(
                  "producerPremiumPromoPercentOff",
                  Number(e.target.value) || 0
                )
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="producer-promo-ends">
              {t("fields.producerPremiumPromoEndsAt")}
            </Label>
            <Input
              id="producer-promo-ends"
              type="datetime-local"
              disabled={!canEdit}
              value={
                form.producerPremiumPromoEndsAt
                  ? form.producerPremiumPromoEndsAt.slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                update(
                  "producerPremiumPromoEndsAt",
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null
                )
              }
            />
          </div>
        </div>
      </AdminSection>

      <AdminSection
        id="vet"
        icon={Stethoscope}
        title={t("sections.vet")}
        description={t("sections.vetDesc")}
        footer={footer("vet")}
      >
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="vet-commission">{t("fields.vetCommission")}</Label>
          <Input
            id="vet-commission"
            type="number"
            min={0}
            max={99}
            step={0.1}
            disabled={!canEdit}
            value={Math.round((form.vetCommissionRate ?? 0.05) * 1000) / 10}
            onChange={(e) => {
              const pct = Number(e.target.value);
              update(
                "vetCommissionRate",
                Number.isFinite(pct) ? pct / 100 : 0.05
              );
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.vetCommissionHint")}
          </p>
        </div>
      </AdminSection>

      <AdminSection
        id="wallet"
        icon={Wallet}
        title={t("sections.wallet")}
        description={t("sections.walletDesc")}
        footer={footer("wallet")}
      >
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="withdraw-threshold">{t("fields.withdrawalThreshold")}</Label>
          <Input
            id="withdraw-threshold"
            type="number"
            min={0}
            disabled={!canEdit}
            value={form.withdrawalAutoApproveThreshold ?? 50000}
            onChange={(e) =>
              update("withdrawalAutoApproveThreshold", Number(e.target.value) || 0)
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.withdrawalThresholdHint")}
          </p>
        </div>
      </AdminSection>
    </>
  );
}
