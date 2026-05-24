import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SmartChart } from "../../../components/charts";
import { FinanceDonutChart } from "../../../components/finance/FinanceDonutChart";
import { FinanceKpiCard } from "../../../components/finance/FinanceKpiCard";
import { ScreenSection } from "../../../components/layout";
import { ModuleAIInsights } from "../../../components/ai/ModuleAIInsights";
import {
  formatHealthDay,
  MORTALITY_WARN_PCT
} from "../../../components/sante/healthUtils";
import type {
  FarmHealthOverviewDto,
  FarmHealthUpcomingDto
} from "../../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string | null;
  activeProfileId?: string | null;
  locale: string;
  overview: FarmHealthOverviewDto | undefined;
  upcomingVaccines: FarmHealthUpcomingDto["vaccines"] | undefined;
  mortalityPct30: number | null;
  isPending: boolean;
  error: Error | null;
  mortalityChartLines: Array<{
    key: string;
    label: string;
    color: string;
    data: { month: string; value: number }[];
  }>;
  diseaseChartLines: Array<{
    key: string;
    label: string;
    color: string;
    data: { month: string; value: number }[];
  }>;
  vaccineChartLines: Array<{
    key: string;
    label: string;
    color: string;
    data: { month: string; value: number }[];
  }>;
  mortalityDonutSlices: Array<{
    label: string;
    value: number;
    color: string;
    display?: string;
  }>;
  chartMonthLabel: (monthKey: string) => string;
  globalStatusLabel: string;
  globalStatusVariant: "green" | "yellow" | "orange";
  nextVetLabel: string;
};

export function HealthOverviewTab({
  farmId,
  accessToken,
  activeProfileId,
  overview,
  upcomingVaccines,
  mortalityPct30,
  isPending,
  error,
  mortalityChartLines,
  diseaseChartLines,
  vaccineChartLines,
  mortalityDonutSlices,
  chartMonthLabel,
  globalStatusLabel,
  globalStatusVariant,
  nextVetLabel,
  locale
}: Props) {
  const { t } = useTranslation();

  if (isPending && !overview) {
    return <ActivityIndicator color={mobileColors.accent} />;
  }
  if (error) {
    return <Text style={styles.err}>{error.message}</Text>;
  }

  return (
    <>
      <ModuleAIInsights
        farmId={farmId}
        module="sante"
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        hasMinimalData={
          (overview?.activeDiseaseCount ?? 0) > 0 ||
          (overview?.charts.mortalityHeadcount ?? []).some((p) => p.value > 0)
        }
      />
      <ScreenSection plain>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiHalf}>
            <FinanceKpiCard
              title={`💀 ${t("health.kpiMortality30")}`}
              value={
                mortalityPct30 != null
                  ? `${mortalityPct30.toLocaleString(locale, {
                      maximumFractionDigits: 2
                    })} %`
                  : "—"
              }
              deltaText={t("health.kpiMortality30Hint")}
              variant={
                mortalityPct30 != null && mortalityPct30 > MORTALITY_WARN_PCT
                  ? "expense"
                  : "green"
              }
            />
          </View>
          <View style={styles.kpiHalf}>
            <FinanceKpiCard
              title={`🤒 ${t("health.kpiActiveCases")}`}
              value={String(overview?.activeDiseaseCount ?? 0)}
              deltaText={null}
              variant={
                (overview?.activeDiseaseCount ?? 0) > 0 ? "orange" : "green"
              }
            />
          </View>
          <View style={styles.kpiHalf}>
            <FinanceKpiCard
              title={`💉 ${t("health.kpiOverdueVaccines")}`}
              value={String(overview?.overdueVaccineCount ?? 0)}
              deltaText={null}
              variant={
                (overview?.overdueVaccineCount ?? 0) > 0 ? "expense" : "green"
              }
            />
          </View>
          <View style={styles.kpiHalf}>
            <FinanceKpiCard
              title={`🩺 ${t("health.kpiNextVet")}`}
              value={nextVetLabel}
              deltaText={null}
              variant="blue"
            />
          </View>
          <View style={styles.kpiHalf}>
            <FinanceKpiCard
              title={`💊 ${t("health.kpiActiveTreatments")}`}
              value={String(overview?.activeTreatmentCount ?? 0)}
              deltaText={null}
              variant="yellow"
            />
          </View>
          <View style={styles.kpiHalf}>
            <FinanceKpiCard
              title={`🏥 ${t("health.kpiGlobalStatus")}`}
              value={globalStatusLabel}
              deltaText={null}
              variant={globalStatusVariant}
            />
          </View>
        </View>
      </ScreenSection>
      <ScreenSection title={t("health.chartMortalityTitle")}>
        <SmartChart
          lines={mortalityChartLines}
          period="6M"
          monthLabel={chartMonthLabel}
          formatValue={(v) => String(Math.round(v))}
          emptyLabel={t("health.chartEmpty")}
        />
      </ScreenSection>
      <ScreenSection title={t("health.chartDiseaseTitle")}>
        <SmartChart
          lines={diseaseChartLines}
          period="6M"
          monthLabel={chartMonthLabel}
          formatValue={(v) => String(Math.round(v))}
          emptyLabel={t("health.chartEmpty")}
        />
      </ScreenSection>
      <ScreenSection title={t("health.chartMortalityCausesTitle")}>
        <FinanceDonutChart
          slices={mortalityDonutSlices}
          emptyLabel={t("health.chartEmpty")}
        />
      </ScreenSection>
      <ScreenSection title={t("health.chartVaccineTitle")}>
        <SmartChart
          lines={vaccineChartLines}
          period="6M"
          monthLabel={chartMonthLabel}
          formatValue={(v) => String(Math.round(v))}
          emptyLabel={t("health.chartEmpty")}
        />
      </ScreenSection>
      {upcomingVaccines?.length ? (
        <ScreenSection title={t("health.upcomingVaccines")}>
          {upcomingVaccines.slice(0, 8).map((v, i) => (
            <Text key={`${v.healthRecord.id}-${i}`} style={styles.meta}>
              {v.vaccineName} ·{" "}
              {v.nextReminderAt
                ? formatHealthDay(v.nextReminderAt, locale)
                : "—"}
            </Text>
          ))}
        </ScreenSection>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  kpiHalf: { width: "48%" },
  meta: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontSize: 14
  },
  err: { color: mobileColors.error }
});
