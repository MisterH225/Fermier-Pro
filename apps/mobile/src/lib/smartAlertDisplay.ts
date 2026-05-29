import type { TFunction } from "i18next";
import type { SmartAlertListItemDto } from "./api";

export function smartAlertCategoryLabel(categoryKey: string, t: TFunction): string {
  return t(`smartAlerts.market.categories.${categoryKey}`, {
    defaultValue: categoryKey
  });
}

export function resolveSmartAlertText(
  alert: SmartAlertListItemDto,
  t: TFunction
): { title: string; message: string } {
  if (alert.i18n) {
    const categoryKey = String(alert.i18n.params?.categoryKey ?? "");
    const params = {
      ...alert.i18n.params,
      category: smartAlertCategoryLabel(categoryKey, t)
    };
    return {
      title: t(alert.i18n.titleKey, params),
      message: t(alert.i18n.messageKey, params)
    };
  }
  return { title: alert.title, message: alert.message };
}
