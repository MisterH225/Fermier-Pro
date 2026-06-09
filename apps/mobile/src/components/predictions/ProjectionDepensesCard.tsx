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
import { formatCurrency } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  currency: string;
  locale: string;
};

export function ProjectionDepensesCard({ payload, currency, locale }: Props) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState<PredictionHorizonKey>("30j");
  const exp = payload.finance_predictions.expense_projections[horizon];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("predictions.projectionDepensesTitle")}</Text>
      <HorizonTabs value={horizon} onChange={setHorizon} />
      <Text style={styles.line}>
        {t("predictions.feedCost")}:{" "}
        {formatCurrency(exp.feed_cost, currency, locale)}
      </Text>
      <Text style={styles.line}>
        {t("predictions.vetCost")}:{" "}
        {formatCurrency(exp.vet_cost, currency, locale)}
      </Text>
      <Text style={styles.total}>
        {t("predictions.total")}: {formatCurrency(exp.total, currency, locale)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  title: { ...mobileTypography.cardTitle },
  line: { ...mobileTypography.body, color: mobileColors.textSecondary },
  total: { ...mobileTypography.body, fontWeight: "700", marginTop: mobileSpacing.xs }
});
