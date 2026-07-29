import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SmartChart } from "../charts";
import {
  FinanceDonutChart,
  financeCategoryColor,
  type FinanceDonutSlice
} from "../finance/FinanceDonutChart";
import { DashboardPeriodPills } from "../common/DashboardPeriodPills";
import { SurfaceCard } from "../common/SurfaceCard";
import { buyerPalette } from "../common/rolePalette";
import { formatMarketMoney } from "../../lib/formatMoney";
import type {
  BuyerDashboardPeriodKey,
  BuyerFinanceOverviewDto
} from "../../lib/api/buyer";
import { buyerColors } from "../../theme/buyerTheme";
import {
  mobileFontSize,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  data: BuyerFinanceOverviewDto | undefined;
  isLoading: boolean;
  period: BuyerDashboardPeriodKey;
  onPeriodChange: (period: BuyerDashboardPeriodKey) => void;
};

function categoryLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  key: string
): string {
  if (key === "shop") return t("buyer.finance.categoryShop");
  if (key.startsWith("shop:")) {
    return t("buyer.finance.categoryShopNamed", { name: key.slice(5) });
  }
  if (
    key === "piglet" ||
    key === "breeder" ||
    key === "butcher" ||
    key === "reformed"
  ) {
    return t(`marketScreen.categories.${key}`);
  }
  return t("buyer.finance.categoryOther");
}

export function BuyerFinanceOverviewTab({
  data,
  isLoading,
  period,
  onPeriodChange
}: Props) {
  const { t } = useTranslation();
  const [chartPeriod, setChartPeriod] = useState<"3M" | "6M" | "12M">("12M");

  const periodOptions = useMemo(
    () =>
      [
        { key: "month" as const, label: t("buyer.dashboard.periodMonth") },
        { key: "quarter" as const, label: t("buyer.dashboard.periodQuarter") },
        { key: "year" as const, label: t("buyer.dashboard.periodYear") }
      ] as const,
    [t]
  );

  const currency = data?.currency ?? "XOF";
  const totals = data?.totals;
  const empty =
    !isLoading &&
    data != null &&
    (totals?.total ?? 0) === 0 &&
    (data.monthlyEvolution?.every((p) => p.total === 0) ?? true);

  const slices: FinanceDonutSlice[] = useMemo(() => {
    return (data?.byCategory ?? []).map((row, index) => ({
      label: categoryLabel(t, row.key),
      value: row.amount,
      color: financeCategoryColor(index),
      display: formatMarketMoney(row.amount, currency)
    }));
  }, [data?.byCategory, currency, t]);

  const chartLines = useMemo(
    () => [
      {
        key: "spent",
        label: t("buyer.finance.chartSpent"),
        color: buyerColors.primary,
        data: (data?.monthlyEvolution ?? []).map((p) => ({
          month: p.month,
          value: p.total
        }))
      }
    ],
    [data?.monthlyEvolution, t]
  );

  const delta = totals?.deltaPct;
  const deltaLabel =
    delta == null
      ? t("buyer.dashboard.purchasesNoBaseline")
      : delta === 0
        ? t("buyer.dashboard.purchasesDeltaFlat")
        : t("buyer.dashboard.purchasesDelta", {
            value: `${delta > 0 ? "+" : ""}${delta}`
          });

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={buyerColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="buyer-finance-overview">
      <SurfaceCard palette={buyerPalette} style={styles.hero}>
        <Text style={styles.heroTitle}>{t("buyer.finance.spentTitle")}</Text>
        <DashboardPeriodPills
          options={periodOptions}
          value={period}
          onChange={onPeriodChange}
          activeBackground={buyerColors.primary}
          activeColor={buyerColors.onPrimary}
          idleBackground={buyerColors.cardBg}
          idleColor={buyerColors.primaryDark}
        />
        {empty ? (
          <Text style={styles.empty}>{t("buyer.finance.overviewEmpty")}</Text>
        ) : (
          <>
            <Text style={styles.heroValue}>
              {formatMarketMoney(totals?.total ?? 0, currency)}
            </Text>
            <Text
              style={[
                styles.delta,
                delta != null && delta > 0 && styles.deltaUp,
                delta != null && delta < 0 && styles.deltaDown
              ]}
            >
              {deltaLabel}
            </Text>
            <Text style={styles.meta}>
              {t("buyer.finance.spentMeta", {
                count: totals?.count ?? 0,
                previous: formatMarketMoney(
                  totals?.previousTotal ?? 0,
                  currency
                )
              })}
            </Text>
          </>
        )}
      </SurfaceCard>

      <SurfaceCard palette={buyerPalette}>
        <Text style={styles.sectionTitle}>
          {t("buyer.finance.byCategory")}
        </Text>
        {slices.length === 0 ? (
          <Text style={styles.empty}>{t("buyer.finance.categoryEmpty")}</Text>
        ) : (
          <FinanceDonutChart
            slices={slices}
            useSliceColors
            centerMode="total"
            centerTitle={t("buyer.finance.donutCenter")}
            emptyLabel={t("buyer.finance.categoryEmpty")}
          />
        )}
      </SurfaceCard>

      <SurfaceCard palette={buyerPalette}>
        <Text style={styles.sectionTitle}>
          {t("buyer.finance.monthlyTitle")}
        </Text>
        {empty ? (
          <Text style={styles.empty}>{t("buyer.finance.chartEmpty")}</Text>
        ) : (
          <SmartChart
            lines={chartLines}
            period={chartPeriod}
            onPeriodChange={setChartPeriod}
            formatValue={(v) => formatMarketMoney(v, currency)}
            unit="XOF"
          />
        )}
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  centered: {
    paddingVertical: mobileSpacing.xxl,
    alignItems: "center"
  },
  hero: {
    backgroundColor: buyerColors.primaryLight,
    gap: mobileSpacing.sm
  },
  heroTitle: {
    ...mobileTypography.cardTitle,
    fontWeight: "800",
    color: buyerColors.textPrimary
  },
  heroValue: {
    marginTop: mobileSpacing.sm,
    fontSize: mobileFontSize.xxl,
    fontWeight: "900",
    color: buyerColors.primaryDark
  },
  delta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.textSecondary
  },
  deltaUp: { color: buyerColors.success },
  deltaDown: { color: buyerColors.danger },
  meta: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    fontWeight: "800",
    color: buyerColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  empty: {
    ...mobileTypography.body,
    color: buyerColors.textSecondary
  }
});
