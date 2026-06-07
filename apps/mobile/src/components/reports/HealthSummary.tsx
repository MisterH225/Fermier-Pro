import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type H = {
  mortalityRate?: number;
  diseaseCases?: number;
  diseaseActive?: number;
  diseaseResolved?: number;
  vaccinesDone?: number;
  vaccinesPlanned?: number;
  vaccineCompletionPct?: number | null;
  vetVisits?: number;
  healthSpend?: string;
  healthStatus?: string;
  topDiseases?: Array<{ label: string; count: number }>;
};

export function HealthSummary({ health }: { health: H | undefined }) {
  const { t } = useTranslation();
  if (!health) {
    return (
      <Text style={styles.muted}>{t("reportsScreen.sectionNoData")}</Text>
    );
  }
  const mortPct = ((Number(health.mortalityRate) || 0) * 100).toFixed(2);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏥 {t("reportsScreen.healthTitle")}</Text>
      <Text style={styles.line}>
        {t("reportsScreen.mortalityRate")}: {mortPct}%
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.diseaseCases")}: {health.diseaseCases ?? 0} (
        {t("reportsScreen.diseaseActive")} {health.diseaseActive ?? 0} /{" "}
        {t("reportsScreen.diseaseResolved")} {health.diseaseResolved ?? 0})
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.vaccines")}: {health.vaccinesDone ?? 0} /{" "}
        {t("reportsScreen.vaccinesPlanned")} {health.vaccinesPlanned ?? 0}
        {health.vaccineCompletionPct != null
          ? ` (${health.vaccineCompletionPct}%)`
          : ""}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.vetVisits")}: {health.vetVisits ?? 0}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.healthCost")}: {health.healthSpend ?? "0"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.healthStatus")}: {health.healthStatus ?? "—"}
      </Text>
      {health.topDiseases?.length ? (
        <>
          <Text style={styles.sub}>{t("reportsScreen.topDiseases")}</Text>
          {health.topDiseases.map((r) => (
            <Text key={r.label} style={styles.line}>
              • {r.label}: {r.count}
            </Text>
          ))}
        </>
      ) : null}
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
