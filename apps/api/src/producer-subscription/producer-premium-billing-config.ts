import type { MerchantPremiumBillingUnit, PlatformSettings } from "@prisma/client";
import {
  applyPromoPercent,
  type MerchantPremiumBillingUnit as BillingUnit
} from "../merchant-shop/merchant-subscription.constants";

export type ProducerPremiumBillingConfig = {
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

export function resolveProducerPremiumBillingConfig(
  settings: Pick<
    PlatformSettings,
    | "producerPremiumPriceXof"
    | "producerPremiumBillingUnit"
    | "producerPremiumBillingInterval"
    | "producerPremiumGraceDays"
    | "producerPremiumTrialEnabled"
    | "producerPremiumTrialUnits"
    | "producerPremiumPromoEnabled"
    | "producerPremiumPromoPercentOff"
    | "producerPremiumPromoEndsAt"
  > | null
): ProducerPremiumBillingConfig {
  const fullPriceXof = Number(settings?.producerPremiumPriceXof ?? 5000);
  const billingUnit = (settings?.producerPremiumBillingUnit ??
    "month") as MerchantPremiumBillingUnit;
  const billingInterval = Math.max(
    1,
    settings?.producerPremiumBillingInterval ?? 1
  );
  const graceDays = Math.max(0, settings?.producerPremiumGraceDays ?? 7);
  const trialEnabled = Boolean(settings?.producerPremiumTrialEnabled);
  const trialUnits = Math.max(1, settings?.producerPremiumTrialUnits ?? 7);
  const promoEndsAt = settings?.producerPremiumPromoEndsAt ?? null;
  const promoStillValid =
    !promoEndsAt || promoEndsAt.getTime() > Date.now();
  const promoEnabled =
    Boolean(settings?.producerPremiumPromoEnabled) && promoStillValid;
  const promoPercentOff = promoEnabled
    ? Math.min(
        100,
        Math.max(0, settings?.producerPremiumPromoPercentOff ?? 0)
      )
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
