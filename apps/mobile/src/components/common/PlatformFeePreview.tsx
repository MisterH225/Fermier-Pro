import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatMarketMoney } from "../../lib/formatMoney";
import {
  formatRatePercentLabel,
  type PlatformFeeBreakdown
} from "../../lib/platformFees";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  breakdown: PlatformFeeBreakdown | null;
  currency: string;
  /** Clé i18n pour l'unité (ex. « par article », « par tête »). */
  unitLabelKey?: string;
  /** Variante compacte sous un champ de saisie. */
  compact?: boolean;
};

/**
 * Aperçu transparent : frais plateforme + montant net reversé.
 * Affiché à la définition d'un prix vendeur / prestation véto.
 */
export function PlatformFeePreview({
  breakdown,
  currency,
  unitLabelKey = "platformFees.unitPerItem",
  compact = false
}: Props) {
  const { t } = useTranslation();

  if (!breakdown) {
    return null;
  }

  const unit = t(unitLabelKey);
  const pctLabel = formatRatePercentLabel(breakdown.ratePct);

  return (
    <View
      style={[styles.box, compact && styles.boxCompact]}
      accessibilityRole="summary"
      testID="platform-fee-preview"
    >
      <Text style={styles.title}>{t("platformFees.previewTitle")}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>
          {t("platformFees.platformFeeLabel", { pct: pctLabel })}
        </Text>
        <Text style={styles.value}>
          {formatMarketMoney(breakdown.feeAmount, currency)}
        </Text>
      </View>
      <View style={[styles.row, styles.netRow]}>
        <Text style={styles.netLabel}>
          {t("platformFees.netPayoutLabel", { unit })}
        </Text>
        <Text style={styles.netValue}>
          {formatMarketMoney(breakdown.netAmount, currency)}
        </Text>
      </View>
      <Text style={styles.hint}>{t("platformFees.previewHint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.sm,
    gap: mobileSpacing.xs
  },
  boxCompact: {
    marginTop: mobileSpacing.xs,
    padding: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent,
    marginBottom: 2
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    flex: 1
  },
  value: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  netRow: {
    marginTop: 2,
    paddingTop: mobileSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  netLabel: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600",
    flex: 1
  },
  netValue: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2,
    lineHeight: 16
  }
});
