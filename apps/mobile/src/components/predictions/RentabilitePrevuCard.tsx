import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type {
  FarmPredictionsPayload,
  PredictionHorizonKey
} from "../../lib/api/predictions";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { HorizonTabs } from "./HorizonTabs";
import { formatCurrency } from "./predictionFormatters";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  payload: FarmPredictionsPayload;
  currency: string;
  locale: string;
};

export function RentabilitePrevuCard({ payload, currency, locale }: Props) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState<PredictionHorizonKey>("30j");
  const pf = payload.finance_predictions?.profitability_forecast?.[horizon];

  // L'IA peut omettre un horizon ou retourner des nombres en string
  if (!pf) return null;
  const margin = Number(pf.margin ?? 0);
  const marginPct = Number(pf.margin_pct ?? 0);
  const positive = margin >= 0;

  return (
    <View style={[styles.card, positive ? styles.positive : styles.negative]}>
      <Text style={styles.title}>{t("predictions.rentabilitePrevuTitle")}</Text>
      <HorizonTabs value={horizon} onChange={setHorizon} />
      <Text style={[styles.margin, positive ? styles.textPos : styles.textNeg]}>
        {formatCurrency(margin, currency, locale)}
      </Text>
      <Text style={[styles.pct, positive ? styles.textPos : styles.textNeg]}>
        {marginPct.toFixed(1)} %
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
  positive: { backgroundColor: uiNamedColors.cE8F8F1 },
  negative: { backgroundColor: uiNamedColors.cFDECEC },
  title: { ...mobileTypography.cardTitle },
  margin: { fontSize: mobileFontSize.xxl, fontWeight: "700" },
  pct: { ...mobileTypography.body, fontWeight: "600" },
  textPos: { color: uiNamedColors.c1D9E75 },
  textNeg: { color: mobileColors.error }
});
