import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { CompositionExplanationDto } from "../../lib/api/feed-composition";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = {
  explanation: CompositionExplanationDto | null;
  loading?: boolean;
};

/**
 * Explication structurée : besoins du stade → pourquoi ce mélange → énergie → écarts.
 * Remplace l'ancien gabarit i18n « bon niveau / fait grossir ».
 */
export function CompositionExplanationBlock({
  explanation,
  loading
}: Props) {
  if (loading && !explanation) {
    return (
      <View style={styles.wrap} testID="composition-explanation-loading">
        <ActivityIndicator color={mobileColors.accent} />
        <Text style={styles.loadingText}>On prépare l’explication…</Text>
      </View>
    );
  }

  if (!explanation) return null;

  return (
    <View style={styles.wrap} testID="composition-explanation">
      <Text style={styles.sectionTitle}>Ce dont vos animaux ont besoin</Text>
      <Text style={styles.body} testID="explanation-stage-needs">
        {explanation.stageNeeds}
      </Text>

      <Text style={styles.sectionTitle}>Pourquoi ce mélange</Text>
      {explanation.ingredientJustifications.map((j) => (
        <View
          key={j.feedIngredientId}
          style={styles.ingredientRow}
          testID={`explanation-ingredient-${j.feedIngredientId}`}
        >
          <Text style={styles.ingredientName}>{j.name}</Text>
          <Text style={styles.body}>{j.text}</Text>
        </View>
      ))}

      <View style={styles.energyBox} testID="explanation-energy">
        <Text style={styles.energyLabel}>Valeur énergétique totale</Text>
        <Text style={styles.energyValue}>
          {explanation.energyKcalPerKg.toLocaleString("fr-FR", {
            maximumFractionDigits: 0
          })}{" "}
          kcal/kg
        </Text>
        <Text style={styles.body}>{explanation.energyComment}</Text>
      </View>

      {explanation.notableDeviations.length > 0 ? (
        <View style={styles.devBox} testID="explanation-deviations">
          <Text style={styles.sectionTitle}>Points à surveiller</Text>
          {explanation.notableDeviations.map((line, i) => (
            <Text key={`dev-${i}`} style={styles.devLine}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {explanation.source === "factual_fallback" ? (
        <Text style={styles.fallbackHint} testID="explanation-fallback-hint">
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
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  sectionTitle: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  body: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    lineHeight: 20,
    fontWeight: "500"
  },
  ingredientRow: {
    gap: 2,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  ingredientName: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  energyBox: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: 4,
    marginTop: mobileSpacing.xs
  },
  energyLabel: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  energyValue: {
    fontSize: mobileFontSize.xxl,
    fontWeight: "800",
    color: mobileColors.textPrimary
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
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  }
});
