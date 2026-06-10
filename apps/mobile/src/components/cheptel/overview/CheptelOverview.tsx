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
import { ModuleAIInsights } from "../../ai/ModuleAIInsights";
import { PredictionsSection } from "../../predictions/PredictionsSection";
import { ScreenSection } from "../../layout/ScreenSection";
import { CategoryBreakdownPanel } from "./CategoryBreakdownPanel";
import { CheptelKPICards } from "./CheptelKPICards";

type Props = {
  overview: CheptelOverviewDto | undefined;
  isLoading: boolean;
  farmId?: string;
  accessToken?: string | null;
  activeProfileId?: string | null;
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

export function CheptelOverview({
  overview,
  isLoading,
  farmId,
  accessToken,
  activeProfileId
}: Props) {
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
    <>
      <ScreenSection plain>
        <CheptelKPICards overview={overview} />
      </ScreenSection>

      {farmId && accessToken ? (
        <>
          <PredictionsSection
            farmId={farmId}
            menu="cheptel"
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            title={t("predictions.sectionCheptel")}
          />
          <ModuleAIInsights
            farmId={farmId}
            module="cheptel"
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            hasMinimalData={(kpis?.totalHeadcount ?? 0) > 0}
          />
        </>
      ) : null}

      {trendLines.length > 0 ? (
        <ScreenSection title={t("cheptel.headcountTrend")}>
          <SmartChart
            lines={trendLines}
            period={chartPeriod}
            onPeriodChange={setChartPeriod}
            formatValue={(v) => String(Math.round(v))}
            monthLabel={(iso) => monthShort(iso, locale)}
          />
        </ScreenSection>
      ) : null}

      <ScreenSection title={t("cheptel.categoryBreakdown")}>
        <CategoryBreakdownPanel rows={overview.categoryBreakdown ?? []} />
      </ScreenSection>
    </>
  );
}

const styles = StyleSheet.create({
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
  }
});
