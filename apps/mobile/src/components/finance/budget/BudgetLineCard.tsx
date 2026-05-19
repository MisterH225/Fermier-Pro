import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FarmBudgetLineDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import {
  formatBudgetMoney,
  lineStatusEmoji,
  progressColorForStatus
} from "./budgetUtils";

type Props = {
  line: FarmBudgetLineDto;
  currencySymbol: string;
  onEdit?: () => void;
};

export function BudgetLineCard({ line, currencySymbol, onEdit }: Props) {
  const { t } = useTranslation();
  const pct = Math.min(150, Math.max(0, line.consumptionPct));
  const barW = `${Math.min(100, pct)}%` as const;
  const icon = line.categoryIcon?.trim() || "📁";
  const title =
    line.categoryKey === "uncategorized"
      ? t("budgetScreen.uncategorizedLine")
      : line.categoryName;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>
          {icon} {title}
        </Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
            <Text style={styles.edit}>{t("budgetScreen.editLine")}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.planned}>
        {t("budgetScreen.lineBudget")}{" "}
        {formatBudgetMoney(line.amountPlanned, line.currency, currencySymbol)}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: barW,
              backgroundColor: progressColorForStatus(line.status)
            }
          ]}
        />
      </View>
      <Text style={styles.meta}>
        {line.consumptionPct}% —{" "}
        {formatBudgetMoney(line.amountRealized, line.currency, currencySymbol)}{" "}
        {t("budgetScreen.spent")}
      </Text>
      <Text style={styles.meta}>
        {t("budgetScreen.lineRemaining")}{" "}
        {formatBudgetMoney(line.remaining, line.currency, currencySymbol)} |{" "}
        {t("budgetScreen.lineProjection")}{" "}
        {formatBudgetMoney(line.amountProjected, line.currency, currencySymbol)}{" "}
        {lineStatusEmoji(line.projectedStatus)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    flex: 1
  },
  edit: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  planned: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  track: {
    height: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    overflow: "hidden",
    marginVertical: mobileSpacing.xs
  },
  fill: { height: "100%", borderRadius: mobileRadius.pill },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
