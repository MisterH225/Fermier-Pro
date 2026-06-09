import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  payload: FarmPredictionsPayload;
};

export function ProjectionPoidsCard({ payload }: Props) {
  const { t } = useTranslation();
  const projections = payload.cheptel_predictions.weight_projections;

  if (!projections.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("predictions.projectionPoidsTitle")}</Text>
      {projections.slice(0, 8).map((pen) => {
        const progress =
          pen.target_weight > 0
            ? Math.min(1, pen.current_avg_weight / pen.target_weight)
            : 0;
        return (
          <View key={pen.pen_id} style={styles.row}>
            <Text style={styles.penName}>{pen.pen_name}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.meta}>
              {Math.round(pen.current_avg_weight)} → {Math.round(pen.projected_30j)} /{" "}
              {Math.round(pen.projected_60j)} / {Math.round(pen.projected_90j)} kg
            </Text>
            <Text style={styles.target}>
              {t("predictions.targetWeight", {
                target: Math.round(pen.target_weight),
                days: pen.days_to_target
              })}
            </Text>
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
  title: { ...mobileTypography.cardTitle, marginBottom: mobileSpacing.xs },
  row: { gap: 4 },
  penName: { ...mobileTypography.body, fontWeight: "600" },
  track: {
    height: 6,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill
  },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  target: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
