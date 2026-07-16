import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SmartChart, type SmartChartLine, type SmartChartPeriod } from "../charts";
import { ScreenSection } from "../layout/ScreenSection";
import { formatMarketMoney } from "../../lib/formatMoney";
import {
  buildSalesSeriesFromOrders,
  type SalesOrderLike
} from "../../lib/merchantProductInsights";
import { merchantColors } from "../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  orders: SalesOrderLike[] | undefined;
  loading?: boolean;
};

export function MerchantProductsSalesSection({ orders, loading }: Props) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<SmartChartPeriod>("6M");
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const series = useMemo(
    () => buildSalesSeriesFromOrders(orders ?? [], { months: 12 }),
    [orders]
  );

  const hasSales = series.some((p) => p.value > 0);

  const lines: SmartChartLine[] = useMemo(
    () => [
      {
        key: "revenue",
        label: t("merchant.products.sales.seriesLabel"),
        color: merchantColors.primary,
        data: series.map((p) => ({ month: p.month, value: p.value }))
      }
    ],
    [series, t]
  );

  const monthLabel = (key: string) => {
    const [y, mo] = key.split("-").map(Number);
    if (!y || !mo) return key;
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(locale, {
      month: "short"
    });
  };

  return (
    <ScreenSection
      title={t("merchant.products.sales.title")}
      style={styles.section}
      cardStyle={styles.card}
    >
      <Text style={styles.subtitle}>{t("merchant.products.sales.subtitle")}</Text>
      {loading ? (
        <ActivityIndicator
          color={merchantColors.primary}
          style={{ marginVertical: mobileSpacing.lg }}
        />
      ) : !hasSales ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t("merchant.products.sales.empty")}</Text>
        </View>
      ) : (
        <SmartChart
          lines={lines}
          period={period}
          onPeriodChange={setPeriod}
          unit="XOF"
          monthLabel={monthLabel}
          formatValue={(v) => formatMarketMoney(v, "XOF")}
          emptyLabel={t("merchant.products.sales.empty")}
          height={200}
        />
      )}
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: mobileSpacing.md },
  card: { backgroundColor: merchantColors.cardBg },
  subtitle: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  emptyBox: {
    paddingVertical: mobileSpacing.lg,
    alignItems: "center"
  },
  empty: {
    ...mobileTypography.body,
    color: merchantColors.textSecondary,
    textAlign: "center"
  }
});
