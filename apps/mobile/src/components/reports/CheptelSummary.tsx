import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Ch = {
  headcountStartEstimate?: number;
  headcountEnd?: number;
  births?: number;
  salesExits?: number;
  deaths?: number;
  reformsExits?: number;
  batchesActive?: number;
  batchesClosed?: number;
  animalsBySpecies?: Array<{ name: string; count: number }>;
};

export function CheptelSummary({ cheptel }: { cheptel: Ch | undefined }) {
  const { t } = useTranslation();
  if (!cheptel) {
    return (
      <Text style={styles.muted}>{t("reportsScreen.sectionNoData")}</Text>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🐷 {t("reportsScreen.cheptelTitle")}</Text>
      <Text style={styles.line}>
        {t("reportsScreen.headStart")}: {cheptel.headcountStartEstimate ?? "—"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.headEnd")}: {cheptel.headcountEnd ?? "—"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.entries")}: {cheptel.births ?? 0}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.exits")}:{" "}
        {(cheptel.salesExits ?? 0) + (cheptel.deaths ?? 0) + (cheptel.reformsExits ?? 0)} (
        {t("reportsScreen.sales")} {cheptel.salesExits ?? 0}, {t("reportsScreen.deaths")}{" "}
        {cheptel.deaths ?? 0}, {t("reportsScreen.reforms")} {cheptel.reformsExits ?? 0})
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.batchesActive")}: {cheptel.batchesActive ?? "—"} —{" "}
        {t("reportsScreen.batchesClosed")}: {cheptel.batchesClosed ?? "—"}
      </Text>
      {cheptel.animalsBySpecies?.length ? (
        <>
          <Text style={styles.sub}>{t("reportsScreen.bySpecies")}</Text>
          {cheptel.animalsBySpecies.map((r) => (
            <Text key={r.name} style={styles.line}>
              • {r.name}: {r.count}
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
