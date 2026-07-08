import type { MerchantPremiumBillingUnit, PlatformSettings } from "@prisma/client";
import {
  applyPromoPercent,
  type MerchantPremiumBillingUnit as BillingUnit
} from "./merchant-subscription.constants";

export type MerchantPremiumBillingConfig = {
  fullPriceXof: number;
  effectivePriceXof: number;
  billingUnit: BillingUnit;
  billingInterval: number;
  graceDays: number;
  trialEnabled: boolean;
  trialUnits: number;
  promoEnabled: boolean;
  promoPercentOff: number;
  promoEndsAt: Date | null;
};

export function resolveMerchantPremiumBillingConfig(
  settings: Pick<
    PlatformSettings,
    | "merchantPremiumPriceXof"
    | "merchantPremiumBillingUnit"
    | "merchantPremiumBillingInterval"
    | "merchantPremiumGraceDays"
    | "merchantPremiumTrialEnabled"
    | "merchantPremiumTrialUnits"
    | "merchantPremiumPromoEnabled"
    | "merchantPremiumPromoPercentOff"
    | "merchantPremiumPromoEndsAt"
  > | null
): MerchantPremiumBillingConfig {
  const fullPriceXof = Number(settings?.merchantPremiumPriceXof ?? 5000);
  const billingUnit = (settings?.merchantPremiumBillingUnit ??
    "month") as MerchantPremiumBillingUnit;
  const billingInterval = Math.max(1, settings?.merchantPremiumBillingInterval ?? 1);
  const graceDays = Math.max(0, settings?.merchantPremiumGraceDays ?? 7);
  const trialEnabled = Boolean(settings?.merchantPremiumTrialEnabled);
  const trialUnits = Math.max(1, settings?.merchantPremiumTrialUnits ?? 7);
  const promoEndsAt = settings?.merchantPremiumPromoEndsAt ?? null;
  const promoStillValid =
    !promoEndsAt || promoEndsAt.getTime() > Date.now();
  const promoEnabled =
    Boolean(settings?.merchantPremiumPromoEnabled) && promoStillValid;
  const promoPercentOff = promoEnabled
    ? Math.min(100, Math.max(0, settings?.merchantPremiumPromoPercentOff ?? 0))
    : 0;
  const effectivePriceXof = applyPromoPercent(fullPriceXof, promoPercentOff);

  return {
    fullPriceXof,
    effectivePriceXof,
    billingUnit: billingUnit as BillingUnit,
    billingInterval,
    graceDays,
    trialEnabled,
    trialUnits,
    promoEnabled,
    promoPercentOff,
    promoEndsAt
  };
}
