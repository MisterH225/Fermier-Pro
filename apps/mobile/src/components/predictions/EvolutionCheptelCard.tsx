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

export function EvolutionCheptelCard({ payload }: Props) {
  const { t } = useTranslation();
  const evo = payload.cheptel_predictions.herd_evolution;
  const bars = [
    { label: t("predictions.now"), value: evo.current_count },
    { label: "30j", value: evo.projected_30j },
    { label: "60j", value: evo.projected_60j },
    { label: "90j", value: evo.projected_90j }
  ];
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("predictions.evolutionCheptelTitle")}</Text>
      <View style={styles.chart}>
        {bars.map((b) => (
          <View key={b.label} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { height: `${(b.value / max) * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.barValue}>{b.value}</Text>
            <Text style={styles.barLabel}>{b.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        {t("predictions.growthRate", {
          rate: (evo.growth_rate * 100).toFixed(1)
        })}
      </Text>
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
  chart: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 120
  },
  barCol: { alignItems: "center", flex: 1, gap: 4 },
  barTrack: {
    width: 28,
    height: 80,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    justifyContent: "flex-end",
    overflow: "hidden"
  },
  barFill: {
    width: "100%",
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.sm
  },
  barValue: { ...mobileTypography.meta, fontWeight: "700" },
  barLabel: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  note: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
