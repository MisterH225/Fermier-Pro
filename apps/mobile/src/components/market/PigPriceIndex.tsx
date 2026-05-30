import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SmartChart, type SmartChartLine } from "../charts";
import { ScreenSection } from "../layout";
import { useSession } from "../../context/SessionContext";
import {
  fetchPigPriceIndexChart,
  fetchPigPriceIndexStats,
  fetchPigPriceIndexTicker,
  type PigPriceIndexPeriod
} from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { CategorySelector, type PigPriceCategoryKey } from "./CategorySelector";
import { PriceStatsRow } from "./PriceStatsRow";
import { PriceTickerBar } from "./PriceTickerBar";

function chartToLines(
  series: Awaited<ReturnType<typeof fetchPigPriceIndexChart>>["series"]
): SmartChartLine[] {
  return series.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    dashed: s.dashed,
    data: s.points.map((p) => ({
      month: p.date,
      value: p.avgPricePerKg,
      limitedData: p.limitedData
    }))
  }));
}

export function PigPriceIndex() {
  const { t, i18n } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [period, setPeriod] = useState<PigPriceIndexPeriod>("30d");
  const [category, setCategory] = useState<PigPriceCategoryKey>("all");

  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const periods: { key: PigPriceIndexPeriod; label: string }[] = [
    { key: "7d", label: t("pigPriceIndex.period7d") },
    { key: "30d", label: t("pigPriceIndex.period30d") },
    { key: "3m", label: t("pigPriceIndex.period3m") },
    { key: "12m", label: t("pigPriceIndex.period12m") }
  ];

  const enabled = Boolean(accessToken);

  const tickerQ = useQuery({
    queryKey: ["pigPriceTicker", activeProfileId],
    queryFn: () => fetchPigPriceIndexTicker(accessToken!, activeProfileId),
    enabled,
    staleTime: 3_600_000
  });

  const chartQ = useQuery({
    queryKey: ["pigPriceChart", activeProfileId, period, category],
    queryFn: () =>
      fetchPigPriceIndexChart(
        accessToken!,
        activeProfileId,
        period,
        category === "all" ? undefined : category
      ),
    enabled,
    staleTime: 3_600_000
  });

  const statsQ = useQuery({
    queryKey: ["pigPriceStats", activeProfileId, period],
    queryFn: () => fetchPigPriceIndexStats(accessToken!, activeProfileId, period),
    enabled,
    staleTime: 3_600_000
  });

  const lines = useMemo(
    () => chartToLines(chartQ.data?.series ?? []),
    [chartQ.data?.series]
  );

  const monthLabel = (key: string) => {
    const d = new Date(`${key}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return key;
    }
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  };

  return (
    <ScreenSection
      title={t("pigPriceIndex.title")}
      headerRight={
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t("pigPriceIndex.badge")}</Text>
        </View>
      }
    >
      <Text style={styles.subtitle}>{t("pigPriceIndex.subtitle")}</Text>
      <PriceTickerBar data={tickerQ.data} />

      <View style={styles.periodRow}>
        {periods.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.periodChip, period === p.key && styles.periodChipOn]}
            onPress={() => setPeriod(p.key)}
          >
            <Text
              style={[styles.periodTx, period === p.key && styles.periodTxOn]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <CategorySelector value={category} onChange={setCategory} />

      {chartQ.isLoading ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 24 }} />
      ) : chartQ.data?.insufficientData ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>
            {chartQ.data.message ?? t("pigPriceIndex.emptyData")}
          </Text>
          <Text style={styles.emptyHint}>{t("pigPriceIndex.emptyDataHint")}</Text>
        </View>
      ) : lines.every((l) => l.data.length === 0) ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t("pigPriceIndex.emptyData")}</Text>
          <Text style={styles.emptyHint}>{t("pigPriceIndex.emptyDataHint")}</Text>
        </View>
      ) : (
        <SmartChart
          lines={lines}
          unit={t("pigPriceIndex.unit")}
          monthLabel={monthLabel}
          formatValue={(v) => `${Math.round(v).toLocaleString(locale)}`}
          emptyLabel={t("pigPriceIndex.emptyData")}
          height={220}
        />
      )}

      <PriceStatsRow stats={statsQ.data} category={category} />
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  badge: {
    backgroundColor: "#F3F0FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill
  },
  badgeText: { fontSize: 10, color: "#7C3AED", fontWeight: "600" },
  periodRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.xs,
    marginTop: mobileSpacing.md
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: "#F1F3F5"
  },
  periodChipOn: { backgroundColor: mobileColors.accent },
  periodTx: { ...mobileTypography.meta, fontWeight: "600", color: "#495057" },
  periodTxOn: { color: "#fff" },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  emptyBox: {
    paddingVertical: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  emptyHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 18
  }
});
