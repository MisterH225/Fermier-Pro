import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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

const PERIODS: { key: PigPriceIndexPeriod; label: string }[] = [
  { key: "7d", label: "7J" },
  { key: "30d", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "12m", label: "12M" }
];

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
  const { accessToken, activeProfileId } = useSession();
  const [period, setPeriod] = useState<PigPriceIndexPeriod>("30d");
  const [category, setCategory] = useState<PigPriceCategoryKey>("all");

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
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <ScreenSection
      title="📊 Cours du porc"
      headerRight={
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Mis à jour toutes les heures</Text>
        </View>
      }
    >
      <Text style={styles.subtitle}>Indice de prix moyen sur la plateforme</Text>
      <PriceTickerBar data={tickerQ.data} />

      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
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
        <Text style={styles.empty}>{chartQ.data.message}</Text>
      ) : (
        <SmartChart
          lines={lines}
          unit="FCFA/kg"
          monthLabel={monthLabel}
          formatValue={(v) => `${Math.round(v).toLocaleString("fr-FR")}`}
          emptyLabel="Données insuffisantes"
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
    textAlign: "center",
    paddingVertical: mobileSpacing.lg
  }
});
