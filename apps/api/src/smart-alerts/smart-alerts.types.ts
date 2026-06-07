import type { SmartAlertModule, SmartAlertPriority } from "@prisma/client";

export type SmartAlertI18nDto = {
  titleKey: string;
  messageKey: string;
  params?: Record<string, string | number>;
};

export type SmartAlertActionDto = {
  label: string;
  route: string;
  params?: Record<string, unknown>;
};

/** Brouillon émis par le moteur avant persistance Prisma. */
export type ComputedSmartAlert = {
  ruleKey: string;
  module: SmartAlertModule;
  priority: SmartAlertPriority;
  title: string;
  message: string;
  i18n?: SmartAlertI18nDto;
  action?: SmartAlertActionDto;
};

export type FarmAlertThresholds = {
  stockCriticalDays: number;
  stockWarningDays: number;
  mortalityRateThresholdPct: number;
  lowBalanceThreshold: number | null;
};
