import type { TFunction } from "i18next";
import type { InsightDto, InsightI18nRef } from "./api/insights";

export function formatInsightRef(
  t: TFunction,
  ref: InsightI18nRef
): string {
  return t(ref.key, ref.params ?? {});
}

export function formatInsightMessage(
  t: TFunction,
  insight: InsightDto
): { message: string; detail?: string } {
  return {
    message: formatInsightRef(t, insight.headline),
    detail: insight.detail
      ? formatInsightRef(t, insight.detail)
      : undefined
  };
}
