import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type {
  FarmPredictionsPayload,
  PredictionHorizonKey
} from "../../lib/api/predictions";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { HorizonTabs } from "./HorizonTabs";
import { formatCurrency } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  currency: string;
  locale: string;
  pricePerKg?: number;
};

export function AnimauxPretsCard({
  payload,
  currency,
  locale,
  pricePerKg
}: Props) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState<PredictionHorizonKey>("30j");
  const cheptel = payload.cheptel_predictions;
  const ready = cheptel?.animals_ready_to_sell?.[horizon];
  const window = cheptel?.best_sale_window;
  if (!ready || !window) {
    return null;
  }
  const estimatedRevenue =
    pricePerKg != null
      ? ready.count * ready.estimated_weight_kg * pricePerKg
      : null;

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>🐷</Text>
      <Text style={styles.title}>{t("predictions.animauxPretsTitle")}</Text>
      <HorizonTabs value={horizon} onChange={setHorizon} />
      <Text style={styles.value}>{ready.count}</Text>
      <Text style={styles.label}>
        {t("predictions.animauxPretsCount", { count: ready.count })}
      </Text>
      <Text style={styles.meta}>
        {t("predictions.avgWeight", {
          weight: Math.round(ready.estimated_weight_kg)
        })}{" "}
        · {ready.category}
      </Text>
      {estimatedRevenue != null ? (
        <Text style={styles.revenue}>
          {t("predictions.potentialRevenue", {
            amount: formatCurrency(estimatedRevenue, currency, locale)
          })}
        </Text>
      ) : null}
      <ConfidenceBadge confidence={window.confidence} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.xs,
    borderLeftWidth: 4,
    borderLeftColor: mobileColors.accent
  },
  emoji: { fontSize: mobileFontSize.xl },
  title: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  value: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.xxl,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  label: { ...mobileTypography.body, color: mobileColors.textSecondary },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  revenue: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600",
    marginTop: mobileSpacing.xs
  }
});
