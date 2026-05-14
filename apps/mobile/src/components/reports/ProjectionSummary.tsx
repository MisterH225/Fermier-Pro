import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type P = {
  nextMonths?: Array<{
    monthOffset: number;
    projectedRevenues: string;
    projectedExpenses: string;
    projectedNet: string;
  }>;
  marginTrend?: string;
};

type AlertRow = { title: string; message: string; priority: string };

export function ProjectionSummary({
  projection,
  alerts
}: {
  projection: P | undefined;
  alerts: AlertRow[] | undefined;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>📈 {t("reportsScreen.projectionTitle")}</Text>
      {projection?.marginTrend ? (
        <Text style={styles.line}>
          {t("reportsScreen.marginTrend")}: {projection.marginTrend}
        </Text>
      ) : null}
      {projection?.nextMonths?.length ? (
        <>
          <Text style={styles.sub}>{t("reportsScreen.projMonths")}</Text>
          {projection.nextMonths.map((m) => (
            <Text key={m.monthOffset} style={styles.line}>
              M+{m.monthOffset}: rev. {m.projectedRevenues} / dép. {m.projectedExpenses} (net{" "}
              {m.projectedNet})
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.muted}>{t("reportsScreen.projectionEmpty")}</Text>
      )}
      <Text style={styles.sub}>{t("reportsScreen.smartAlertsTop")}</Text>
      {alerts?.length ? (
        alerts.map((a, i) => (
          <Text key={`${a.title}-${i}`} style={styles.line}>
            • [{a.priority}] {a.title}: {a.message}
          </Text>
        ))
      ) : (
        <Text style={styles.muted}>{t("reportsScreen.noAlerts")}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    gap: mobileSpacing.xs
  },
  title: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  sub: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  line: { ...mobileTypography.body, color: mobileColors.textPrimary },
  muted: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
