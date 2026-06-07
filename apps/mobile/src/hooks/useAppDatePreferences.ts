import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../context/SessionContext";
import {
  formatAppDate,
  formatAppDateTime,
  formatAppMonthYear,
  type AppDateFormatPref
} from "../lib/appDate";
import { fetchFarmSettings } from "../lib/api";
import type { AppLocaleCode } from "../lib/appLocale";

export function useAppDatePreferences(farmId?: string) {
  const { i18n } = useTranslation();
  const { accessToken, activeProfileId } = useSession();

  const locale = (
    i18n.resolvedLanguage ?? i18n.language
  ).split("-")[0] as AppLocaleCode;
  const pickerLocale = locale === "en" ? "en" : "fr";

  const settingsQ = useQuery({
    queryKey: ["farmSettings", farmId, activeProfileId],
    queryFn: () => fetchFarmSettings(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(farmId && accessToken),
    staleTime: 5 * 60_000
  });

  const dateFormat = (settingsQ.data?.app.dateFormat ??
    "DD/MM/YYYY") as AppDateFormatPref;

  return useMemo(
    () => ({
      locale,
      pickerLocale,
      dateFormat,
      formatDate: (d: Date | null) =>
        d ? formatAppDate(d, dateFormat) : "",
      formatDateTime: (d: Date | null) =>
        d ? formatAppDateTime(d, dateFormat) : "",
      formatMonthYear: (d: Date | null) =>
        d ? formatAppMonthYear(d, locale) : ""
    }),
    [locale, pickerLocale, dateFormat]
  );
}
