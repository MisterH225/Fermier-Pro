import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SmartChart } from "../../charts";
import { financeMonthsToSingleLine } from "../../charts/smartChartAdapters";
import type { SmartChartPeriod } from "../../charts";
import type { CheptelOverviewDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { CategoryBreakdownPanel } from "./CategoryBreakdownPanel";

type Props = {
  overview: CheptelOverviewDto | undefined;
  isLoading: boolean;
};

function monthShort(iso: string, locale: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) {
    return iso;
  }
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
    month: "short"
  });
}

export function CheptelOverview({ overview, isLoading }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const [chartPeriod, setChartPeriod] = useState<SmartChartPeriod>("6M");

  const kpis = overview?.kpis;

  const trendLines = useMemo(() => {
    const months = overview?.headcountTrend ?? [];
    if (!months.length) {
      return [];
    }
    return financeMonthsToSingleLine(
      months.map((m) => ({ month: m.month, net: m.total })),
      "headcount",
      t("cheptel.totalHeadcount"),
      mobileColors.accent,
      (m) => Number(m.net ?? 0)
    );
  }, [overview?.headcountTrend, t]);

  if (isLoading && !overview) {
    return <ActivityIndicator color={mobileColors.accent} style={styles.loader} />;
  }

  if (!overview) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{kpis?.totalHeadcount ?? "—"}</Text>
          <Text style={styles.kpiLab}>{t("cheptel.totalHeadcount")}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>
            {kpis?.maleAnimals ?? "—"} / {kpis?.femaleAnimals ?? "—"}
          </Text>
          <Text style={styles.kpiLab}>{t("cheptel.sexSplit")}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>
            {kpis?.occupancyRate != null ? `${kpis.occupancyRate}%` : "—"}
          </Text>
          <Text style={styles.kpiLab}>{t("cheptel.occupancy")}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{kpis?.availablePensCount ?? "—"}</Text>
          <Text style={styles.kpiLab}>{t("cheptel.availablePens")}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{kpis?.unassignedAnimalsCount ?? "—"}</Text>
          <Text style={styles.kpiLab}>{t("cheptel.unassignedAnimals")}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{kpis?.penOccupancyHeadcount ?? "—"}</Text>
          <Text style={styles.kpiLab}>{t("cheptel.penOcc")}</Text>
        </View>
      </View>

      {trendLines.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t("cheptel.headcountTrend")}</Text>
          <View style={styles.chartCard}>
            <SmartChart
              lines={trendLines}
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
              formatValue={(v) => String(Math.round(v))}
              monthLabel={(iso) => monthShort(iso, locale)}
            />
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionTitle, styles.sectionSp]}>
        {t("cheptel.categoryBreakdown")}
      </Text>
      <View style={styles.chartCard}>
        <CategoryBreakdownPanel rows={overview.categoryBreakdown ?? []} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  loader: { marginTop: mobileSpacing.xl },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  kpiCard: {
    width: "47%",
    flexGrow: 1,
    minWidth: "46%",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  kpiVal: {
    fontSize: 20,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  kpiLab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.md
  },
  sectionSp: { marginTop: mobileSpacing.lg },
  chartCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  }
});
