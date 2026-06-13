import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { formatPredictionDate } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  locale: string;
};

export function NaissancesPrevuesCard({ payload, locale }: Props) {
  const { t } = useTranslation();
  const births = payload.gestation_predictions.upcoming_births;
  const gp = payload.gestation_predictions;

  if (!births.length && gp.projected_new_animals_30j === 0) {
    return null;
  }

  const avgConfidence =
    births.length > 0
      ? births.reduce((s, b) => s + b.confidence, 0) / births.length
      : 0.5;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("predictions.naissancesPrevuesTitle")}</Text>
      {births.slice(0, 8).map((b) => (
        <Text key={b.sow_id} style={styles.line}>
          {t("predictions.birthLine", {
            sow: b.sow_number,
            date: formatPredictionDate(b.expected_birth_date, locale),
            count: b.expected_piglets_count
          })}
        </Text>
      ))}
      <Text style={styles.total}>
        {t("predictions.piglets30j", { count: gp.projected_new_animals_30j })}
      </Text>
      <ConfidenceBadge confidence={avgConfidence} />
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
  total: { ...mobileTypography.body, fontWeight: "600", marginTop: mobileSpacing.xs }
});
