import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { CompositionExplanationDto } from "../../lib/api/feed-composition";
import {
  compositionUiColors,
  type CompositionUiTone
} from "../../theme/compositionUiTone";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = {
  explanation: CompositionExplanationDto | null;
  loading?: boolean;
  tone?: CompositionUiTone;
};

/**
 * Explication structurée : besoins du stade → pourquoi ce mélange → énergie → écarts.
 * Remplace l'ancien gabarit i18n « bon niveau / fait grossir ».
 */
export function CompositionExplanationBlock({
  explanation,
  loading,
  tone = "producer"
}: Props) {
  const ui = compositionUiColors(tone);

  if (loading && !explanation) {
    return (
      <View style={styles.wrap} testID="composition-explanation-loading">
        <ActivityIndicator color={ui.accent} />
        <Text style={[styles.loadingText, { color: ui.textSecondary }]}>
          On prépare l’explication…
        </Text>
      </View>
    );
  }

  if (!explanation) return null;

  return (
    <View style={styles.wrap} testID="composition-explanation">
      <Text style={[styles.sectionTitle, { color: ui.textPrimary }]}>
        Ce dont vos animaux ont besoin
      </Text>
      <Text
        style={[styles.body, { color: ui.textPrimary }]}
        testID="explanation-stage-needs"
      >
        {explanation.stageNeeds}
      </Text>

      <Text style={[styles.sectionTitle, { color: ui.textPrimary }]}>
        Pourquoi ce mélange
      </Text>
      {explanation.ingredientJustifications.map((j) => (
        <View
          key={j.feedIngredientId}
          style={[styles.ingredientRow, { borderBottomColor: ui.border }]}
          testID={`explanation-ingredient-${j.feedIngredientId}`}
        >
          <Text style={[styles.ingredientName, { color: ui.textPrimary }]}>
            {j.name}
          </Text>
          <Text style={[styles.body, { color: ui.textPrimary }]}>{j.text}</Text>
        </View>
      ))}

      <View
        style={[styles.energyBox, { backgroundColor: ui.accentSoft }]}
        testID="explanation-energy"
      >
        <Text style={[styles.energyLabel, { color: ui.textSecondary }]}>
          Valeur énergétique totale
        </Text>
        <Text style={[styles.energyValue, { color: ui.textPrimary }]}>
          {explanation.energyKcalPerKg.toLocaleString("fr-FR", {
            maximumFractionDigits: 0
          })}{" "}
          kcal/kg
        </Text>
        <Text style={[styles.body, { color: ui.textPrimary }]}>
          {explanation.energyComment}
        </Text>
      </View>

      {explanation.notableDeviations.length > 0 ? (
        <View style={styles.devBox} testID="explanation-deviations">
          <Text style={[styles.sectionTitle, { color: ui.textPrimary }]}>
            Points à surveiller
          </Text>
          {explanation.notableDeviations.map((line, i) => (
            <Text key={`dev-${i}`} style={styles.devLine}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {explanation.source === "factual_fallback" ? (
        <Text
          style={[styles.fallbackHint, { color: ui.textSecondary }]}
          testID="explanation-fallback-hint"
        >
          Explication simplifiée (assistant indisponible).
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  loadingText: {
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  sectionTitle: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    marginTop: mobileSpacing.xs
  },
  body: {
    fontSize: mobileFontSize.sm,
    lineHeight: 20,
    fontWeight: "500"
  },
  ingredientRow: {
    gap: 2,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  ingredientName: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700"
  },
  energyBox: {
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: 4,
    marginTop: mobileSpacing.xs
  },
  energyLabel: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600"
  },
  energyValue: {
    fontSize: mobileFontSize.xxl,
    fontWeight: "800"
  },
  devBox: {
    backgroundColor: mobileStatusSurfaces.warningBg,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: 4
  },
  devLine: {
    fontSize: mobileFontSize.sm,
    color: mobileStatusSurfaces.warningText,
    fontWeight: "600",
    lineHeight: 20
  },
  fallbackHint: {
    fontSize: mobileFontSize.xs,
    fontStyle: "italic"
  }
});
