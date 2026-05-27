import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ProfitabilityPeriodDto } from "../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { ICPhaseCard } from "./ICPhaseCard";
import { formatIc } from "./profitabilityFormat";

type Props = { data: ProfitabilityPeriodDto };

export function ICPanel({ data }: Props) {
  const { t } = useTranslation();
  const { icByPhase } = data;
  const phases = [icByPhase.starter, icByPhase.growth, icByPhase.fattening];
  const globalIc = icByPhase.global.icCalculated;

  return (
    <View>
      <Text style={styles.title}>{t("profitability.icTitle")}</Text>
      <Text style={styles.desc}>{t("profitability.icDesc")}</Text>
      {!icByPhase.allFeedTypesQualified ? (
        <View style={styles.warn}>
          <Text style={styles.warnTx}>{t("profitability.feedPhaseWarning")}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        {phases.map((p) => (
          <ICPhaseCard key={p.phase} phase={p} />
        ))}
      </View>
      {globalIc != null ? (
        <Text style={styles.global}>
          {t("profitability.icGlobal", { ic: formatIc(globalIc) })}
        </Text>
      ) : null}
      {phases[0]?.icCalculated != null ? (
        <View style={styles.explain}>
          <Text style={styles.explainTx}>
            {t("profitability.icExplain", {
              ic: formatIc(phases[0].icCalculated),
              target: formatIc(phases[0].icTarget)
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...mobileTypography.sectionTitle, marginBottom: 4 },
  desc: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginBottom: mobileSpacing.md },
  warn: {
    backgroundColor: "#FFF8E1",
    padding: mobileSpacing.sm,
    borderRadius: 8,
    marginBottom: mobileSpacing.sm
  },
  warnTx: { ...mobileTypography.meta, color: "#F57C00" },
  row: { flexDirection: "row", gap: mobileSpacing.sm, flexWrap: "wrap" },
  global: { ...mobileTypography.meta, marginTop: mobileSpacing.md, fontStyle: "italic" },
  explain: {
    marginTop: mobileSpacing.md,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.canvas,
    borderRadius: 8
  },
  explainTx: { ...mobileTypography.body, lineHeight: 20 }
});
