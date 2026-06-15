import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type {
  FarmPredictionsPayload,
  PredictionHorizonKey
} from "../../lib/api/predictions";
import {
  coerceFiniteNumber,
  formatOptionalPct
} from "../../lib/coerceNumber";
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

export function RentabilitePrevuCard({ payload, currency, locale }: Props) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState<PredictionHorizonKey>("30j");
  const pf = payload.finance_predictions.profitability_forecast[horizon];

  if (!pf) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t("predictions.rentabilitePrevuTitle")}</Text>
        <HorizonTabs value={horizon} onChange={setHorizon} />
      </View>
    );
  }

  const margin = coerceFiniteNumber(pf.margin) ?? 0;
  const marginPctStr = formatOptionalPct(pf.margin_pct) ?? "—";
  const positive = margin >= 0;

  return (
    <View style={[styles.card, positive ? styles.positive : styles.negative]}>
      <Text style={styles.title}>{t("predictions.rentabilitePrevuTitle")}</Text>
      <HorizonTabs value={horizon} onChange={setHorizon} />
      <Text style={[styles.margin, positive ? styles.textPos : styles.textNeg]}>
        {formatCurrency(margin, currency, locale)}
      </Text>
      <Text style={[styles.pct, positive ? styles.textPos : styles.textNeg]}>
        {marginPctStr}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  positive: { backgroundColor: "#E8F8F1" },
  negative: { backgroundColor: "#FDECEC" },
  title: { ...mobileTypography.cardTitle },
  margin: { fontSize: 26, fontWeight: "700" },
  pct: { ...mobileTypography.body, fontWeight: "600" },
  textPos: { color: "#1D9E75" },
  textNeg: { color: "#D64545" }
});
