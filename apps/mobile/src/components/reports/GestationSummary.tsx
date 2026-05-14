import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type G = {
  farrowingsCount?: number;
  activeBreeders?: number;
  gestationSuccessPct?: number | null;
  avgPigletsPerFarrowing?: number | null;
  neonatalMortalityPct?: number | null;
  avgDaysBetweenFarrowing?: number | null;
};

export function GestationSummary({ gestation }: { gestation: G | undefined }) {
  const { t } = useTranslation();
  if (!gestation) {
    return (
      <Text style={styles.muted}>{t("reportsScreen.sectionNoData")}</Text>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🐣 {t("reportsScreen.gestationTitle")}</Text>
      <Text style={styles.line}>
        {t("reportsScreen.farrowings")}: {gestation.farrowingsCount ?? 0}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.gestationSuccess")}:{" "}
        {gestation.gestationSuccessPct != null
          ? `${gestation.gestationSuccessPct}%`
          : "—"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.avgPiglets")}:{" "}
        {gestation.avgPigletsPerFarrowing != null
          ? String(gestation.avgPigletsPerFarrowing)
          : "—"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.neonatalMort")}:{" "}
        {gestation.neonatalMortalityPct != null
          ? `${gestation.neonatalMortalityPct}%`
          : "—"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.activeBreeders")}: {gestation.activeBreeders ?? 0}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.avgFarrowingInterval")}:{" "}
        {gestation.avgDaysBetweenFarrowing != null
          ? String(gestation.avgDaysBetweenFarrowing)
          : "—"}
      </Text>
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
  line: { ...mobileTypography.body, color: mobileColors.textPrimary },
  muted: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
