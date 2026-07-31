import { StyleSheet, Text, View } from "react-native";
import type {
  FeedFormulateResultDto,
  ProductionStage
} from "../../lib/api/feed-composition";
import {
  asRationLines,
  buildInfeasibilityMessage,
  formatDeviationHuman,
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
        <Text style={styles.infeasibleTitle}>On n’a pas pu faire ce mélange</Text>
        <Text style={styles.infeasibleBody}>
          {buildInfeasibilityMessage(formulation.infeasibilityReasons)}
        </Text>
        {formulation.infeasibilityReasons?.length > 1 ? (
          <View style={styles.reasons}>
            {formulation.infeasibilityReasons.slice(1).map((r) => (
              <Text key={r} style={styles.reasonLine}>
                • {r
                  .replace(/protéine brute/gi, "protéines")
                  .replace(/énergie métabolisable/gi, "énergie")
                  .replace(/intrants disponibles/gi, "produits disponibles")}
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
      <Text style={styles.lead}>
        Voici le mélange proposé pour vos porcs — quantités et coût estimés.
      </Text>

      <View style={styles.costRow}>
        <View style={styles.costBlock}>
          <Text style={styles.costLabel}>Coût total estimé</Text>
          <Text style={styles.costValue} testID="formulation-total-cost">
            {formatXof(formulation.totalCostXof)}
          </Text>
        </View>
        <View style={styles.costBlock}>
          <Text style={styles.costLabel}>Soit par kilo</Text>
          <Text style={styles.costValue} testID="formulation-cost-per-kg">
            {formatXof(formulation.costPerKg)}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {formatKg(formulation.totalFeedKg)} de mélange au total · environ{" "}
        {formatKg(formulation.dailyIntakeKg)} par jour et par animal
      </Text>

      {isTheoretical ? (
        <Text style={styles.theoretical}>
          Prix indicatifs du catalogue — ce n’est pas encore un devis de moulin.
        </Text>
      ) : null}

      {isLeanPorkStage(stage) ? (
        <View
          style={[styles.leanBadge, leanOk ? styles.leanOk : styles.leanWarn]}
          testID="lean-pork-badge"
        >
          <Text style={styles.leanText}>
            {leanOk
              ? "Bon pour un porc moins gras (engraissement / finition)"
              : "À surveiller : risque de porcs plus gras"}
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Ce qu’il faut mélanger</Text>
      <View style={styles.tableHead}>
        <Text style={[styles.th, styles.colName]}>Produit</Text>
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
          <Text style={styles.sectionTitle}>Est-ce que ça convient ?</Text>
          <Text style={styles.sectionSub}>
            On compare le mélange aux besoins de vos porcs à cette période.
          </Text>
          {formulation.deviations.map((d) => (
            <View
              key={`${d.nutrient}-${d.target}`}
              style={[
                styles.devCard,
                d.withinBounds ? styles.devCardOk : styles.devCardBad
              ]}
            >
              <Text
                style={[
                  styles.devText,
                  d.withinBounds ? styles.devOk : styles.devBad
                ]}
              >
                {formatDeviationHuman(d)}
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
  lead: {
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    fontWeight: "600",
    lineHeight: 22
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
    fontSize: mobileFontSize.sm,
    lineHeight: 20
  },
  theoretical: {
    color: mobileStatusSurfaces.infoText,
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    lineHeight: 20
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
  sectionSub: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    lineHeight: 20,
    marginTop: -4
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
    color: mobileColors.textSecondary
  },
  td: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  colName: { flex: 1.4 },
  colQty: { flex: 1, textAlign: "right" },
  colPct: { flex: 0.7, textAlign: "right" },
  devCard: {
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  devCardOk: {
    backgroundColor: mobileStatusSurfaces.successBg
  },
  devCardBad: {
    backgroundColor: mobileStatusSurfaces.warningBg
  },
  devText: {
    fontSize: mobileFontSize.sm,
    lineHeight: 20,
    fontWeight: "600"
  },
  devOk: { color: mobileStatusSurfaces.successText },
  devBad: { color: mobileStatusSurfaces.warningText },
  warnBox: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    gap: 4
  },
  warnText: {
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary,
    lineHeight: 18
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
    color: mobileColors.textSecondary,
    lineHeight: 20
  }
});
