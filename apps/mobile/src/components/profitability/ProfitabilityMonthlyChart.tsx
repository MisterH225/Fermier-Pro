import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  SmartChart,
  type SmartChartLine,
  type SmartChartPeriod
} from "../charts";
import { formatFinanceChartValue } from "../finance/financeChartFormat";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type ProfitabilityMonthPoint = {
  month: string;
  revenuesRealized: number;
  costsTotal: number;
  netMargin: number;
};

type Props = {
  series: ProfitabilityMonthPoint[] | undefined;
  currencySymbol: string;
  /** Hide the section title when embedded under a ScreenSection title. */
  hideTitle?: boolean;
};

function monthShort(iso: string, locale: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
    month: "short"
  });
}

export function ProfitabilityMonthlyChart({
  series,
  currencySymbol,
  hideTitle = false
}: Props) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<SmartChartPeriod>("6M");
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const lines: SmartChartLine[] = useMemo(() => {
    if (!series?.length) return [];
    return [
      {
        key: "margin",
        label: t("profitability.netMargin"),
        color: mobileColors.accent,
        data: series.map((m) => ({
          month: m.month,
          value: m.netMargin
        }))
      },
      {
        key: "revenues",
        label: t("profitability.revenues"),
        color: mobileColors.success,
        data: series.map((m) => ({
          month: m.month,
          value: m.revenuesRealized
        }))
      },
      {
        key: "costs",
        label: t("profitability.costs"),
        color: mobileColors.error,
        data: series.map((m) => ({
          month: m.month,
          value: m.costsTotal
        }))
      }
    ];
  }, [series, t]);

  if (!lines.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {!hideTitle ? (
        <Text style={styles.title}>{t("profitability.monthlyTrend")}</Text>
      ) : null}
      <Text style={styles.subtitle}>{t("profitability.monthlyTrendHint")}</Text>
      <SmartChart
        lines={lines}
        period={period}
        onPeriodChange={setPeriod}
        height={200}
        unit={currencySymbol}
        formatValue={(v) => formatFinanceChartValue(v, currencySymbol)}
        monthLabel={(iso) => monthShort(iso, locale)}
        emptyLabel={t("profitability.noMonthlyData")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: mobileSpacing.md },
  title: {
    ...mobileTypography.cardTitle,
    fontWeight: "700",
    marginBottom: mobileSpacing.xs
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  }
});
