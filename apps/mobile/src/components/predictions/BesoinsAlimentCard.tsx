import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type {
  FarmPredictionsPayload,
  PredictionHorizonKey
} from "../../lib/api/predictions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { HorizonTabs } from "./HorizonTabs";
import { formatPredictionDate } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  locale: string;
};

export function BesoinsAlimentCard({ payload, locale }: Props) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState<PredictionHorizonKey>("30j");
  const needs = payload.stock_predictions?.feed_needs;

  if (!Array.isArray(needs) || needs.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🌾 {t("predictions.besoinsAlimentTitle")}</Text>
      <HorizonTabs value={horizon} onChange={setHorizon} />
      {needs.map((feed) => {
        // Coercion : l'IA peut retourner des nombres sous forme de strings
        const currentStockKg = Number(feed.current_stock_kg ?? 0);
        const dailyConsumptionKg = Number(feed.daily_consumption_kg ?? 0);
        const needed = Number(
          horizon === "30j"
            ? feed.needed_30j_kg
            : horizon === "60j"
              ? feed.needed_60j_kg
              : feed.needed_90j_kg
        ) || 0;
        const daysLeft =
          dailyConsumptionKg > 0
            ? Math.floor(currentStockKg / dailyConsumptionKg)
            : null;
        const status =
          daysLeft == null
            ? "unknown"
            : daysLeft >= 30
              ? "sufficient"
              : daysLeft >= 7
                ? "warning"
                : "critical";

        return (
          <View key={feed.feed_type_id} style={styles.feedRow}>
            <Text style={styles.feedName}>{feed.feed_type_name}</Text>
            <Text style={styles.meta}>
              {t("predictions.currentStock", {
                kg: Math.round(currentStockKg)
              })}
            </Text>
            <Text style={styles.meta}>
              {t("predictions.dailyConsumption", {
                kg: dailyConsumptionKg.toFixed(1)
              })}
            </Text>
            <Text style={styles.needed}>
              {t("predictions.neededKg", { kg: Math.round(needed) })}
            </Text>
            {status === "sufficient" ? (
              <Text style={styles.ok}>✅ {t("predictions.stockSufficient")}</Text>
            ) : null}
            {status === "warning" ? (
              <Text style={styles.warn}>
                ⚠️ {t("predictions.stockWarning", {
                  date: formatPredictionDate(feed.reorder_recommended_date, locale)
                })}
              </Text>
            ) : null}
            {status === "critical" ? (
              <Text style={styles.critical}>
                🔴 {t("predictions.stockCritical", {
                  date: formatPredictionDate(feed.stock_depletion_date, locale)
                })}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  title: { ...mobileTypography.cardTitle },
  feedRow: {
    gap: 4,
    paddingBottom: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  feedName: { ...mobileTypography.body, fontWeight: "600" },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  needed: { ...mobileTypography.body },
  ok: { ...mobileTypography.meta, color: "#1D9E75" },
  warn: { ...mobileTypography.meta, color: "#BA7517" },
  critical: { ...mobileTypography.meta, color: "#D64545" }
});
