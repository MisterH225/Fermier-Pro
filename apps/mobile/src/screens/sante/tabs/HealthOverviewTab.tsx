import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { KpiGridSkeleton } from "../../../components/common/SkeletonBlocks";
import { SmartChart } from "../../../components/charts";
import { FinanceDonutChart } from "../../../components/finance/FinanceDonutChart";
import {
  CheptelStyleKpiCard,
  cheptelKpiGridStyles
} from "../../../components/cheptel/overview/CheptelStyleKpiCard";
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
import { getUserFacingError } from "../../../lib/userFacingError";
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
    return <KpiGridSkeleton count={4} />;
  }
  if (error) {
    return <Text style={styles.err}>{getUserFacingError(error, t)}</Text>;
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
        <View style={cheptelKpiGridStyles.grid}>
          <View style={cheptelKpiGridStyles.half}>
            <CheptelStyleKpiCard
              icon="💀"
              bg="#FFF3E0"
              accent="#F57F17"
              label={t("health.kpiMortality30")}
              value={
                mortalityPct30 != null
                  ? `${mortalityPct30.toLocaleString(locale, {
                      maximumFractionDigits: 2
                    })} %`
                  : "—"
              }
            />
          </View>
          <View style={cheptelKpiGridStyles.half}>
            <CheptelStyleKpiCard
              icon="🤒"
              bg="#FCE4EC"
              accent="#E91E8C"
              label={t("health.kpiActiveCases")}
              value={String(overview?.activeDiseaseCount ?? 0)}
            />
          </View>
          <View style={cheptelKpiGridStyles.half}>
            <CheptelStyleKpiCard
              icon="💉"
              bg="#E8F5E9"
              accent="#2E7D32"
              label={t("health.kpiOverdueVaccines")}
              value={String(overview?.overdueVaccineCount ?? 0)}
            />
          </View>
          <View style={cheptelKpiGridStyles.half}>
            <CheptelStyleKpiCard
              icon="🩺"
              bg="#E3F2FD"
              accent="#1565C0"
              label={t("health.kpiNextVet")}
              value={nextVetLabel}
            />
          </View>
          <View style={cheptelKpiGridStyles.half}>
            <CheptelStyleKpiCard
              icon="💊"
              bg="#EDE7F6"
              accent="#6A1B9A"
              label={t("health.kpiActiveTreatments")}
              value={String(overview?.activeTreatmentCount ?? 0)}
            />
          </View>
          <View style={cheptelKpiGridStyles.half}>
            <CheptelStyleKpiCard
              icon="🏥"
              bg="#FFF8E1"
              accent="#FF8C00"
              label={t("health.kpiGlobalStatus")}
              value={globalStatusLabel}
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
