import type { TFunction } from "i18next";
import type { SubscriptionLimitErrorCode } from "./api/http";

/** Affiche une limite API (null = illimité) — jamais de chiffre inventé côté client. */
export function formatLimitLabel(
  t: TFunction,
  max: number | null | undefined
): string {
  if (max == null) {
    return t("subscriptionLimits.unlimited");
  }
  return String(max);
}

export function limitFeatureLine(
  t: TFunction,
  key: string,
  max: number | null | undefined
): string {
  if (max == null) {
    return t(`${key}Unlimited`);
  }
  return t(key, { count: max });
}

export function upgradeLimitCopy(
  t: TFunction,
  code: SubscriptionLimitErrorCode,
  limit: number | null | undefined
): { title: string; body: string } {
  if (code === "FARM_LIMIT_REACHED") {
    return {
      title: t("subscriptionLimits.upgrade.farmTitle"),
      body:
        limit == null
          ? t("subscriptionLimits.upgrade.farmBodyGeneric")
          : t("subscriptionLimits.upgrade.farmBody", { count: limit })
    };
  }
  if (code === "SHOP_LIMIT_REACHED") {
    return {
      title: t("subscriptionLimits.upgrade.shopTitle"),
      body:
        limit == null
          ? t("subscriptionLimits.upgrade.shopBodyGeneric")
          : t("subscriptionLimits.upgrade.shopBody", { count: limit })
    };
  }
  return {
    title: t("subscriptionLimits.upgrade.productTitle"),
    body:
      limit == null
        ? t("subscriptionLimits.upgrade.productBodyGeneric")
        : t("subscriptionLimits.upgrade.productBody", { count: limit })
  };
}
