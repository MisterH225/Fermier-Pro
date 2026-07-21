import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  CheptelStyleKpiCard,
  cheptelKpiGridStyles
} from "../cheptel/overview/CheptelStyleKpiCard";
import { FinanceDonutChart } from "../finance/FinanceDonutChart";
import { SmartChart } from "../charts";
import { ScreenSection } from "../layout/ScreenSection";
import { BatchProfitabilityCard } from "./BatchProfitabilityCard";
import { BreakevenCard } from "./BreakevenCard";
import { ProfitabilityInsightsCard } from "./ProfitabilityInsightsCard";
import {
  fetchBatchProfitabilityList,
  fetchFarmProfitability,
  fetchProfitabilityInsights,
  type ProfitabilityPeriodKey,
  type ProfitabilityViewMode
} from "../../lib/api";
import {
  coerceFiniteNumber,
  formatOptionalNumber,
  formatOptionalPct,
  roundCoerced
} from "../../lib/coerceNumber";
import { formatFarmMoney as formatMoney } from "../../lib/formatMoney";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileKpiPalette } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";
import { buyerColors } from "../../theme/buyerTheme";
import { vetColors } from "../../theme/vetTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  currencySymbol: string;
};

const PERIODS: ProfitabilityPeriodKey[] = [
  "current_month",
  "current_quarter",
  "current_year",
  "all_time"
];

export function RentabilityScreen({
  farmId,
  accessToken,
  activeProfileId,
  currencySymbol
}: Props) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ProfitabilityPeriodKey>("current_month");
  const [viewMode, setViewMode] = useState<ProfitabilityViewMode>("combined");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const farmQ = useQuery({
    queryKey: ["farmProfitability", farmId, period, activeProfileId],
    queryFn: () =>
      fetchFarmProfitability(accessToken, farmId, activeProfileId, period)
  });

  const batchesQ = useQuery({
    queryKey: ["batchProfitability", farmId, activeProfileId],
    queryFn: () =>
      fetchBatchProfitabilityList(accessToken, farmId, activeProfileId)
  });

  const insightsQ = useQuery({
    queryKey: ["profitabilityInsights", farmId, period, activeProfileId],
    queryFn: () =>
      fetchProfitabilityInsights(accessToken, farmId, activeProfileId, period)
  });

  const data = farmQ.data;
  const metrics = useMemo(() => {
    if (!data) return null;
    if (viewMode === "realized") return data.realized;
    if (viewMode === "projected") return data.projected;
    return data.combined;
  }, [data, viewMode]);

  const revCostLines = useMemo(() => {
    if (!data?.monthlySeries?.length) return [];
    return [
      {
        key: "revenues",
        label: t("profitability.revenues"),
        color: mobileColors.success,
        data: data.monthlySeries.map((m) => ({
          month: m.month,
          value: m.revenuesRealized
        }))
      },
      {
        key: "costs",
        label: t("profitability.costs"),
        color: mobileColors.error,
        data: data.monthlySeries.map((m) => ({
          month: m.month,
          value: m.costsTotal
        }))
      },
      {
        key: "margin",
        label: t("profitability.netMargin"),
        color: mobileColors.accent,
        data: data.monthlySeries.map((m) => ({
          month: m.month,
          value: m.netMargin
        }))
      }
    ];
  }, [data?.monthlySeries, t]);

  const batchComparison = useMemo(() => {
    const rows = batchesQ.data ?? [];
    return [...rows].sort(
      (a, b) =>
        (b.realized.netMarginPct ?? -999) - (a.realized.netMarginPct ?? -999)
    );
  }, [batchesQ.data]);

  const selectedBatch =
    batchComparison.find((b) => b.batchId === selectedBatchId) ??
    batchComparison[0] ??
    null;

  if (farmQ.isPending && !data) {
    return <ActivityIndicator color={mobileColors.accent} style={styles.loader} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenSection title={t("profitability.globalTitle")} plain>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.pillRow}>
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                style={[styles.pill, period === p && styles.pillOn]}
                onPress={() => setPeriod(p)}
              >
                <Text
                  style={[styles.pillText, period === p && styles.pillTextOn]}
                >
                  {t(`profitability.period.${p}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.segmentRow}>
          {(["realized", "projected", "combined"] as ProfitabilityViewMode[]).map(
            (mode) => (
              <Pressable
                key={mode}
                style={[styles.segment, viewMode === mode && styles.segmentOn]}
                onPress={() => setViewMode(mode)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    viewMode === mode && styles.segmentTextOn
                  ]}
                >
                  {t(`profitability.view.${mode}`)}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {data?.dataQuality === "insufficient" ? (
          <Text style={styles.insufficient}>
            {data.dataQualityMessage ?? t("profitability.insufficientData")}
          </Text>
        ) : metrics ? (
          <View style={cheptelKpiGridStyles.grid}>
            <View style={cheptelKpiGridStyles.half}>
              <CheptelStyleKpiCard
                icon="📊"
                bg={producerColors.successMintBg}
                accent={uiNamedColors.c16A34A}
                label={t("profitability.grossMargin")}
                value={
                  metrics.grossMargin != null
                    ? formatMoney(metrics.grossMargin, data!.currency, currencySymbol)
                    : "—"
                }
                unit={formatOptionalPct(metrics.grossMarginPct) ?? undefined}
              />
            </View>
            <View style={cheptelKpiGridStyles.half}>
              <CheptelStyleKpiCard
                icon="💰"
                bg={uiNamedColors.cEFF6FF}
                accent={uiNamedColors.c2563EB}
                label={t("profitability.netMargin")}
                value={
                  metrics.netMargin != null
                    ? formatMoney(metrics.netMargin, data!.currency, currencySymbol)
                    : "—"
                }
                unit={formatOptionalPct(metrics.netMarginPct) ?? undefined}
              />
            </View>
            <View style={cheptelKpiGridStyles.half}>
              <CheptelStyleKpiCard
                icon="⚖️"
                bg={uiNamedColors.cFFF7ED}
                accent={uiNamedColors.cEA580C}
                label={t("profitability.costPerKg")}
                value={
                  roundCoerced(metrics.costPerKg) != null
                    ? `${roundCoerced(metrics.costPerKg)}`
                    : "—"
                }
                unit={
                  roundCoerced(data?.marketPricePerKg) != null
                    ? `${currencySymbol}/kg · ${t("profitability.market")} ${roundCoerced(data?.marketPricePerKg)}`
                    : `${currencySymbol}/kg`
                }
              />
            </View>
            <View style={cheptelKpiGridStyles.half}>
              <CheptelStyleKpiCard
                icon="📈"
                bg={uiNamedColors.cF5F3FF}
                accent={buyerColors.primary}
                label="ROI"
                value={formatOptionalPct(metrics.roi) ?? "—"}
                unit={t("profitability.roiHint")}
              />
            </View>
          </View>
        ) : null}

        {data ? (
          <View style={styles.sectionGap}>
            <BreakevenCard
              data={data}
              currencySymbol={currencySymbol}
              viewMode={viewMode}
            />
          </View>
        ) : null}

        {data?.costBreakdown?.length ? (
          <View style={styles.sectionGap}>
            <Text style={styles.chartTitle}>
              {t("profitability.costBreakdown")}
            </Text>
            <FinanceDonutChart
              slices={data.costBreakdown.map((c, i) => ({
                label: c.label,
                value: c.amount,
                display: `${roundCoerced(c.pct) ?? 0}%`,
                color: [mobileKpiPalette.gestation.accent, producerColors.chartBlue, producerColors.chartGreen, uiNamedColors.cA855F7, vetColors.danger][i % 5]!
              }))}
            />
          </View>
        ) : null}

        {revCostLines.length > 0 ? (
          <View style={styles.sectionGap}>
            <Text style={styles.chartTitle}>
              {t("profitability.revenueVsCosts")}
            </Text>
            <SmartChart lines={revCostLines} compact height={180} />
          </View>
        ) : null}
      </ScreenSection>

      <ScreenSection title={t("profitability.byBatchTitle")} plain>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.pillRow}>
            {batchComparison.map((b) => {
              const pctVal = coerceFiniteNumber(b.realized.netMarginPct);
              const positive = pctVal != null && pctVal >= 0;
              return (
                <Pressable
                  key={b.batchId}
                  style={[
                    styles.batchPill,
                    selectedBatch?.batchId === b.batchId && styles.batchPillOn,
                    {
                      borderColor: positive ? uiNamedColors.c16A34A : uiNamedColors.cDC2626
                    }
                  ]}
                  onPress={() => setSelectedBatchId(b.batchId)}
                >
                  <Text style={styles.batchPillText}>{b.batchName}</Text>
                  {formatOptionalNumber(pctVal, 0) ? (
                    <Text
                      style={[
                        styles.batchPillPct,
                        { color: positive ? uiNamedColors.c16A34A : uiNamedColors.cDC2626 }
                      ]}
                    >
                      {formatOptionalNumber(pctVal, 0)}%
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {selectedBatch ? (
          <BatchProfitabilityCard
            batch={selectedBatch}
            currencySymbol={currencySymbol}
          />
        ) : batchesQ.isPending ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : (
          <Text style={styles.insufficient}>
            {t("profitability.noBatches")}
          </Text>
        )}
      </ScreenSection>

      <ScreenSection plain>
        <ProfitabilityInsightsCard
          insights={insightsQ.data?.insights ?? []}
          isLoading={insightsQ.isPending}
          available={insightsQ.data?.available ?? false}
          onRefresh={() => void insightsQ.refetch()}
        />
      </ScreenSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: mobileSpacing.xl },
  loader: { marginTop: mobileSpacing.xl },
  pillRow: { flexDirection: "row", gap: 8, paddingBottom: mobileSpacing.sm },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillOn: { backgroundColor: mobileColors.textPrimary },
  pillText: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  pillTextOn: { color: mobileColors.background },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: mobileSpacing.md
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    alignItems: "center"
  },
  segmentOn: { backgroundColor: mobileColors.accent },
  segmentText: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  segmentTextOn: { color: mobileColors.background },
  insufficient: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  sectionGap: { marginTop: mobileSpacing.lg },
  chartTitle: {
    ...mobileTypography.cardTitle,
    fontWeight: "700",
    marginBottom: mobileSpacing.sm
  },
  batchPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.md,
    borderWidth: 2,
    backgroundColor: mobileColors.surface,
    minWidth: 100
  },
  batchPillOn: { backgroundColor: uiNamedColors.cF0FDF4 },
  batchPillText: { ...mobileTypography.meta, fontWeight: "700" },
  batchPillPct: { ...mobileTypography.meta, fontWeight: "800", marginTop: 2 }
});
