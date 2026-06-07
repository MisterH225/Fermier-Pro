import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FarmBudgetGlobalDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import {
  formatBudgetMoney,
  globalStatusKey,
  progressColorForStatus
} from "./budgetUtils";

type Props = {
  global: FarmBudgetGlobalDto;
  currency: string;
  currencySymbol: string;
};

export function GlobalBudgetGauge({ global, currency, currencySymbol }: Props) {
  const { t } = useTranslation();
  const pct = Math.min(150, Math.max(0, global.consumptionPct));
  const barW = `${Math.min(100, pct)}%` as const;
  const statusKey = globalStatusKey(global.status);
  const barColor = progressColorForStatus(
    global.status === "on_track" ? "ok" : global.status
  );
  const delta = Number(global.deltaProjected);
  const deltaPositive = delta > 0;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{t("budgetScreen.totalPlanned")}</Text>
        <Text style={styles.value}>
          {formatBudgetMoney(global.totalPlanned, currency, currencySymbol)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t("budgetScreen.spentToDate")}</Text>
        <Text style={styles.value}>
          {formatBudgetMoney(global.totalRealized, currency, currencySymbol)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t("budgetScreen.remaining")}</Text>
        <Text style={styles.value}>
          {formatBudgetMoney(global.remaining, currency, currencySymbol)}
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: barW, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.pct}>
        {t("budgetScreen.consumedPct", { pct: global.consumptionPct })}
      </Text>

      <Text style={styles.proj}>
        {t("budgetScreen.projectionEom", {
          amount: formatBudgetMoney(
            global.projectedEndOfMonth,
            currency,
            currencySymbol
          )
        })}
      </Text>
      <Text
        style={[
          styles.delta,
          deltaPositive ? styles.deltaBad : styles.deltaGood
        ]}
      >
        {deltaPositive
          ? t("budgetScreen.deltaOver", {
              amount: formatBudgetMoney(Math.abs(delta), currency, currencySymbol)
            })
          : t("budgetScreen.deltaUnder", {
              amount: formatBudgetMoney(Math.abs(delta), currency, currencySymbol)
            })}
      </Text>
      <Text style={styles.statusHint}>{t(`budgetScreen.status.${statusKey}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  label: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  value: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  track: {
    height: 10,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    overflow: "hidden",
    marginTop: mobileSpacing.sm
  },
  fill: {
    height: "100%",
    borderRadius: mobileRadius.pill
  },
  pct: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  proj: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  delta: {
    ...mobileTypography.meta,
    fontWeight: "600"
  },
  deltaBad: { color: mobileColors.error },
  deltaGood: { color: mobileColors.success },
  statusHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
