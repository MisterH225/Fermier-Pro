import { StyleSheet, Text, View } from "react-native";
import type {
  CompositionExplanationDto,
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
import {
  compositionUiColors,
  type CompositionUiTone
} from "../../theme/compositionUiTone";
import { CompositionExplanationBlock } from "./CompositionExplanationBlock";

type Props = {
  formulation: FeedFormulateResultDto;
  stage?: ProductionStage | string;
  isTheoretical?: boolean;
  explanation?: CompositionExplanationDto | null;
  explanationLoading?: boolean;
  /** Profil actif : aligne les accents (vert producteur / bleu véto). */
  tone?: CompositionUiTone;
};

export function FormulationResultCard({
  formulation,
  stage,
  isTheoretical,
  explanation,
  explanationLoading,
  tone = "producer"
}: Props) {
  const ui = compositionUiColors(tone);

  if (!formulation.feasible) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: ui.background, borderColor: ui.border }
        ]}
        testID="formulation-infeasible"
      >
        <Text style={styles.infeasibleTitle}>On n’a pas pu faire ce mélange</Text>
        <Text style={[styles.infeasibleBody, { color: ui.textPrimary }]}>
          {buildInfeasibilityMessage(formulation.infeasibilityReasons)}
        </Text>
        {formulation.infeasibilityReasons?.length > 1 ? (
          <View style={styles.reasons}>
            {formulation.infeasibilityReasons.slice(1).map((r) => (
              <Text key={r} style={[styles.reasonLine, { color: ui.textSecondary }]}>
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
    <View
      style={[
        styles.card,
        { backgroundColor: ui.background, borderColor: ui.border }
      ]}
      testID="formulation-result"
    >
      <Text style={[styles.lead, { color: ui.textPrimary }]}>
        Voici le mélange proposé pour vos porcs — quantités et coût estimés.
      </Text>

      <View style={styles.costRow}>
        <View style={[styles.costBlock, { backgroundColor: ui.accentSoft }]}>
          <Text style={[styles.costLabel, { color: ui.textSecondary }]}>
            Coût total estimé
          </Text>
          <Text
            style={[styles.costValue, { color: ui.textPrimary }]}
            testID="formulation-total-cost"
          >
            {formatXof(formulation.totalCostXof)}
          </Text>
        </View>
        <View style={[styles.costBlock, { backgroundColor: ui.accentSoft }]}>
          <Text style={[styles.costLabel, { color: ui.textSecondary }]}>
            Soit par kilo
          </Text>
          <Text
            style={[styles.costValue, { color: ui.textPrimary }]}
            testID="formulation-cost-per-kg"
          >
            {formatXof(formulation.costPerKg)}
          </Text>
        </View>
      </View>

      <Text style={[styles.meta, { color: ui.textSecondary }]}>
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
          <Text style={[styles.leanText, { color: ui.textPrimary }]}>
            {leanOk
              ? "Bon pour un porc moins gras (engraissement / finition)"
              : "À surveiller : risque de porcs plus gras"}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: ui.textPrimary }]}>
        Ce qu’il faut mélanger
      </Text>
      <View style={[styles.tableHead, { borderBottomColor: ui.border }]}>
        <Text style={[styles.th, styles.colName, { color: ui.textSecondary }]}>
          Produit
        </Text>
        <Text style={[styles.th, styles.colQty, { color: ui.textSecondary }]}>
          Quantité
        </Text>
        <Text style={[styles.th, styles.colPct, { color: ui.textSecondary }]}>
          Part
        </Text>
      </View>
      {lines.map((line) => (
        <View
          key={line.feedIngredientId}
          style={[styles.tableRow, { borderBottomColor: ui.border }]}
          testID={`ration-line-${line.feedIngredientId}`}
        >
          <Text
            style={[styles.td, styles.colName, { color: ui.textPrimary }]}
            numberOfLines={2}
          >
            {rationLineName(line)}
          </Text>
          <Text style={[styles.td, styles.colQty, { color: ui.textPrimary }]}>
            {formatKg(line.quantityKg)}
          </Text>
          <Text style={[styles.td, styles.colPct, { color: ui.textPrimary }]}>
            {formatPct(line.proportionPct)}
          </Text>
        </View>
      ))}

      <CompositionExplanationBlock
        explanation={explanation ?? null}
        loading={explanationLoading}
        tone={tone}
      />

      {formulation.warnings?.length ? (
        <View style={[styles.warnBox, { backgroundColor: ui.surfaceMuted }]}>
          {formulation.warnings.map((w) => (
            <Text key={w} style={[styles.warnText, { color: ui.textSecondary }]}>
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
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  lead: {
    fontSize: mobileFontSize.md,
    fontWeight: "600",
    lineHeight: 22
  },
  costRow: {
    flexDirection: "row",
    gap: mobileSpacing.md
  },
  costBlock: {
    flex: 1,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md
  },
  costLabel: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    marginBottom: 4
  },
  costValue: {
    fontSize: mobileFontSize.xxl,
    fontWeight: "800"
  },
  meta: {
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
    fontSize: mobileFontSize.sm
  },
  sectionTitle: {
    marginTop: mobileSpacing.sm,
    fontSize: mobileFontSize.md,
    fontWeight: "700"
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingBottom: 6
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  th: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700"
  },
  td: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600"
  },
  colName: { flex: 1.4 },
  colQty: { flex: 1, textAlign: "right" },
  colPct: { flex: 0.7, textAlign: "right" },
  warnBox: {
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    gap: 4
  },
  warnText: {
    fontSize: mobileFontSize.xs,
    lineHeight: 18
  },
  infeasibleTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.error
  },
  infeasibleBody: {
    fontSize: mobileFontSize.md,
    lineHeight: 22,
    fontWeight: "600"
  },
  reasons: { gap: 4, marginTop: 4 },
  reasonLine: {
    fontSize: mobileFontSize.sm,
    lineHeight: 20
  }
});
