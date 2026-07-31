import { StyleSheet, Text, View } from "react-native";
import type {
  FeedFormulateResultDto,
  ProductionStage
} from "../../lib/api/feed-composition";
import {
  asRationLines,
  buildInfeasibilityMessage,
  formatKg,
  formatPct,
  formatXof,
  isLeanPorkStage,
  rationLineName,
  respectsLeanPorkGoal
} from "../../lib/feedCompositionFormat";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = {
  formulation: FeedFormulateResultDto;
  stage?: ProductionStage | string;
  isTheoretical?: boolean;
};

export function FormulationResultCard({
  formulation,
  stage,
  isTheoretical
}: Props) {
  if (!formulation.feasible) {
    return (
      <View style={styles.card} testID="formulation-infeasible">
        <Text style={styles.infeasibleTitle}>Ration impossible</Text>
        <Text style={styles.infeasibleBody}>
          {buildInfeasibilityMessage(formulation.infeasibilityReasons)}
        </Text>
        {formulation.infeasibilityReasons?.length > 1 ? (
          <View style={styles.reasons}>
            {formulation.infeasibilityReasons.slice(1).map((r) => (
              <Text key={r} style={styles.reasonLine}>
                • {r}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  const lines = asRationLines(formulation.ration);
  const leanOk = respectsLeanPorkGoal(formulation, stage);

  return (
    <View style={styles.card} testID="formulation-result">
      <View style={styles.costRow}>
        <View style={styles.costBlock}>
          <Text style={styles.costLabel}>Coût total</Text>
          <Text style={styles.costValue} testID="formulation-total-cost">
            {formatXof(formulation.totalCostXof)}
          </Text>
        </View>
        <View style={styles.costBlock}>
          <Text style={styles.costLabel}>Coût / kg</Text>
          <Text style={styles.costValue} testID="formulation-cost-per-kg">
            {formatXof(formulation.costPerKg)}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {formatKg(formulation.totalFeedKg)} au total ·{" "}
        {formatKg(formulation.dailyIntakeKg)} / jour / tête
      </Text>

      {isTheoretical ? (
        <Text style={styles.theoretical}>
          Prix de catalogue (indicatif) — ce n’est pas un devis moulin.
        </Text>
      ) : null}

      {isLeanPorkStage(stage) ? (
        <View
          style={[styles.leanBadge, leanOk ? styles.leanOk : styles.leanWarn]}
          testID="lean-pork-badge"
        >
          <Text style={styles.leanText}>
            {leanOk
              ? "Objectif « porc sans graisse » respecté"
              : "Objectif « porc sans graisse » à surveiller"}
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Intrants</Text>
      <View style={styles.tableHead}>
        <Text style={[styles.th, styles.colName]}>Nom</Text>
        <Text style={[styles.th, styles.colQty]}>Quantité</Text>
        <Text style={[styles.th, styles.colPct]}>Part</Text>
      </View>
      {lines.map((line) => (
        <View
          key={line.feedIngredientId}
          style={styles.tableRow}
          testID={`ration-line-${line.feedIngredientId}`}
        >
          <Text style={[styles.td, styles.colName]} numberOfLines={2}>
            {rationLineName(line)}
          </Text>
          <Text style={[styles.td, styles.colQty]}>
            {formatKg(line.quantityKg)}
          </Text>
          <Text style={[styles.td, styles.colPct]}>
            {formatPct(line.proportionPct)}
          </Text>
        </View>
      ))}

      {formulation.deviations?.length ? (
        <>
          <Text style={styles.sectionTitle}>Nutrition vs cible</Text>
          {formulation.deviations.map((d) => (
            <View key={d.nutrient} style={styles.devRow}>
              <Text style={styles.devName}>{d.nutrient}</Text>
              <Text style={styles.devTarget}>cible {d.target}</Text>
              <Text
                style={[
                  styles.devActual,
                  d.withinBounds ? styles.devOk : styles.devBad
                ]}
              >
                {Number.isFinite(d.actual)
                  ? d.actual.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2
                    })
                  : "—"}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {formulation.warnings?.length ? (
        <View style={styles.warnBox}>
          {formulation.warnings.map((w) => (
            <Text key={w} style={styles.warnText}>
              {w}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  costRow: {
    flexDirection: "row",
    gap: mobileSpacing.md
  },
  costBlock: {
    flex: 1,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md
  },
  costLabel: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    marginBottom: 4
  },
  costValue: {
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.xxl,
    fontWeight: "800"
  },
  meta: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm
  },
  theoretical: {
    color: mobileStatusSurfaces.infoText,
    fontSize: mobileFontSize.sm,
    fontWeight: "600"
  },
  leanBadge: {
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  leanOk: {
    backgroundColor: mobileStatusSurfaces.successBg
  },
  leanWarn: {
    backgroundColor: mobileStatusSurfaces.warningBg
  },
  leanText: {
    fontWeight: "700",
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary
  },
  sectionTitle: {
    marginTop: mobileSpacing.sm,
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.border,
    paddingBottom: 6
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  th: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    textTransform: "uppercase"
  },
  td: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  colName: { flex: 1.4 },
  colQty: { flex: 1, textAlign: "right" },
  colPct: { flex: 0.7, textAlign: "right" },
  devRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4
  },
  devName: {
    flex: 1.2,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  devTarget: {
    flex: 1,
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary
  },
  devActual: {
    flex: 0.7,
    textAlign: "right",
    fontSize: mobileFontSize.sm,
    fontWeight: "700"
  },
  devOk: { color: mobileColors.success },
  devBad: { color: mobileColors.error },
  warnBox: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    gap: 4
  },
  warnText: {
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary
  },
  infeasibleTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.error
  },
  infeasibleBody: {
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    lineHeight: 22,
    fontWeight: "600"
  },
  reasons: { gap: 4, marginTop: 4 },
  reasonLine: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  }
});
