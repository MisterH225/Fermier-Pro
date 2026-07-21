import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsResult } from "../../lib/api/predictions";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  data: FarmPredictionsResult;
};

export function InsufficientDataCard({ data }: Props) {
  const { t } = useTranslation();
  const info = data.insufficient_data;
  if (!info) {
    return null;
  }

  const progress = Math.min(1, info.current_days / 30);

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>🔮</Text>
      <Text style={styles.title}>{t("predictions.insufficientTitle")}</Text>
      <Text style={styles.message}>
        {t("predictions.insufficientMessage", {
          days: info.days_remaining
        })}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {t("predictions.progressLabel", {
          current: info.current_days,
          total: 30
        })}
      </Text>
      {info.missing?.gmq ? (
        <Text style={styles.hint}>{t("predictions.missingGmq")}</Text>
      ) : null}
      {info.missing?.price ? (
        <Text style={styles.hint}>{t("predictions.missingPrice")}</Text>
      ) : null}
      {info.missing?.feed ? (
        <Text style={styles.hint}>{t("predictions.missingFeed")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  icon: {
    fontSize: mobileFontSize.xxl
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  progressTrack: {
    height: 8,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    overflow: "hidden",
    marginTop: mobileSpacing.xs
  },
  progressFill: {
    height: "100%",
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill
  },
  progressLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  }
});
