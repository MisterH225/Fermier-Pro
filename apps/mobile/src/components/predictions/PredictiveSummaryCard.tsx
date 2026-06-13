import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatCurrency } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  currency: string;
  locale: string;
};

export function PredictiveSummaryCard({ payload, currency, locale }: Props) {
  const { t } = useTranslation();
  const ready30 =
    payload.cheptel_predictions?.animals_ready_to_sell?.["30j"]?.count;
  const revenue30 =
    payload.finance_predictions?.revenue_estimates?.["30j"]?.amount;
  const feedNeeds = payload.stock_predictions?.feed_needs;
  const piglets30 = payload.gestation_predictions?.projected_new_animals_30j;

  if (
    ready30 == null ||
    revenue30 == null ||
    !Array.isArray(feedNeeds) ||
    piglets30 == null
  ) {
    return null;
  }

  const feedReorder = feedNeeds.reduce(
    (s, f) => s + (f.reorder_quantity_kg > 0 ? f.reorder_quantity_kg : 0),
    0
  );

  const kpis = [
    { icon: "🐷", label: t("predictions.kpiReady"), value: `${ready30} / 30j` },
    {
      icon: "💰",
      label: t("predictions.kpiRevenue"),
      value: formatCurrency(revenue30, currency, locale)
    },
    {
      icon: "🌾",
      label: t("predictions.kpiFeed"),
      value: `${Math.round(feedReorder)} kg`
    },
    {
      icon: "👶",
      label: t("predictions.kpiBirths"),
      value: `~${piglets30}`
    }
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {kpis.map((k) => (
        <View key={k.label} style={styles.kpi}>
          <Text style={styles.icon}>{k.icon}</Text>
          <Text style={styles.value}>{k.value}</Text>
          <Text style={styles.label}>{k.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: mobileSpacing.sm, paddingVertical: mobileSpacing.xs },
  kpi: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    minWidth: 130,
    gap: 4
  },
  icon: { fontSize: 22 },
  value: { ...mobileTypography.body, fontWeight: "700" },
  label: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
