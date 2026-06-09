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
import { ConfidenceBadge } from "./ConfidenceBadge";
import { HorizonTabs } from "./HorizonTabs";
import { formatCurrency } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  currency: string;
  locale: string;
};

export function RevenusEstimesCard({ payload, currency, locale }: Props) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState<PredictionHorizonKey>("30j");
  const rev = payload.finance_predictions.revenue_estimates[horizon];
  const exp = payload.finance_predictions.expense_projections[horizon];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>💰 {t("predictions.revenusEstimesTitle")}</Text>
      <HorizonTabs value={horizon} onChange={setHorizon} />
      <Text style={styles.amount}>
        {formatCurrency(rev.amount, currency, locale)}
      </Text>
      <Text style={styles.basedOn}>{rev.based_on}</Text>
      <ConfidenceBadge confidence={rev.confidence} />
      <View style={styles.compare}>
        <View style={styles.barRev}>
          <View
            style={[
              styles.barFillRev,
              {
                width: `${Math.min(100, (rev.amount / Math.max(rev.amount, exp.total, 1)) * 100)}%`
              }
            ]}
          />
        </View>
        <View style={styles.barExp}>
          <View
            style={[
              styles.barFillExp,
              {
                width: `${Math.min(100, (exp.total / Math.max(rev.amount, exp.total, 1)) * 100)}%`
              }
            ]}
          />
        </View>
        <Text style={styles.legend}>
          {t("predictions.revVsExp", {
            rev: formatCurrency(rev.amount, currency, locale),
            exp: formatCurrency(exp.total, currency, locale)
          })}
        </Text>
      </View>
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
  amount: {
    fontSize: 28,
    fontWeight: "700",
    color: mobileColors.accent
  },
  basedOn: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  compare: { marginTop: mobileSpacing.sm, gap: 4 },
  barRev: {
    height: 8,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    overflow: "hidden"
  },
  barFillRev: { height: "100%", backgroundColor: "#1D9E75" },
  barExp: {
    height: 8,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    overflow: "hidden"
  },
  barFillExp: { height: "100%", backgroundColor: "#D64545" },
  legend: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
