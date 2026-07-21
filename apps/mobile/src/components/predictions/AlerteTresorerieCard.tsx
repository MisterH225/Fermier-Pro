import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import { mobileRadius, mobileSpacing, mobileTypography, mobileColors } from "../../theme/mobileTheme";
import { formatPredictionDate } from "./predictionFormatters";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  payload: FarmPredictionsPayload;
  locale: string;
};

export function AlerteTresorerieCard({ payload, locale }: Props) {
  const { t } = useTranslation();
  const alert = payload.finance_predictions?.cash_flow_alert;

  if (!alert?.has_alert || !alert.message) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>⚠️ {t("predictions.alerteTresorerieTitle")}</Text>
      <Text style={styles.message}>{alert.message}</Text>
      {alert.alert_date ? (
        <Text style={styles.date}>
          {t("predictions.alertDate", {
            date: formatPredictionDate(alert.alert_date, locale)
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: uiNamedColors.cFDECEC,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: mobileColors.error
  },
  title: { ...mobileTypography.cardTitle, color: mobileColors.error },
  message: { ...mobileTypography.body },
  date: { ...mobileTypography.meta, color: uiNamedColors.c8B3A3A }
});
