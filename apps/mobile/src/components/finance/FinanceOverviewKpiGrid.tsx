import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { FinanceOverviewDto } from "../../lib/api";
import { formatFarmMoney as formatMoney } from "../../lib/formatMoney";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { KpiGridSkeleton } from "../common/SkeletonBlocks";
import { FinanceKpiCard } from "./FinanceKpiCard";
import {
  financeCumulativeBalanceSeries,
  financeMonthExpenseSeries,
  financeMonthNetSeries,
  financeMonthRevenueSeries
} from "./financeSparklineSeries";

function pctDeltaString(cur: number, prev: number): string | null {
  if (!Number.isFinite(prev) || prev === 0) {
    return null;
  }
  const p = ((cur - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

type Props = {
  enabled: boolean;
  overview: FinanceOverviewDto | undefined;
  isPending: boolean;
  error: string | null;
  sectionTitle: string;
  disabledHint: string;
  onPress: () => void;
};

export function FinanceOverviewKpiGrid({
  enabled,
  overview,
  isPending,
  error,
  sectionTitle,
  disabledHint,
  onPress
}: Props) {
  const { t } = useTranslation();

  const months6 = useMemo(() => {
    if (overview?.months6?.length) {
      return overview.months6;
    }
    return overview?.months3 ?? [];
  }, [overview]);

  const revSeries = useMemo(
    () => financeMonthRevenueSeries(months6),
    [months6]
  );
  const expSeries = useMemo(
    () => financeMonthExpenseSeries(months6),
    [months6]
  );
  const netSeries = useMemo(
    () => financeMonthNetSeries(months6),
    [months6]
  );
  const balanceSeries = useMemo(
    () =>
      overview
        ? financeCumulativeBalanceSeries(months6, overview.balanceAllTime)
        : [],
    [months6, overview]
  );

  const revDelta = useMemo(() => {
    if (months6.length < 2) {
      return null;
    }
    const pct = pctDeltaString(
      Number(months6[months6.length - 1]!.revenues),
      Number(months6[months6.length - 2]!.revenues)
    );
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months6, t]);

  const expDelta = useMemo(() => {
    if (months6.length < 2) {
      return null;
    }
    const pct = pctDeltaString(
      Number(months6[months6.length - 1]!.expenses),
      Number(months6[months6.length - 2]!.expenses)
    );
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months6, t]);

  const marginDelta = useMemo(() => {
    if (months6.length < 2) {
      return null;
    }
    const n1 =
      Number(months6[months6.length - 1]!.revenues) -
      Number(months6[months6.length - 1]!.expenses);
    const n0 =
      Number(months6[months6.length - 2]!.revenues) -
      Number(months6[months6.length - 2]!.expenses);
    const pct = pctDeltaString(n1, n0);
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months6, t]);

  const curCode = overview?.settings.currencyCode ?? "XOF";
  const curSym = overview?.settings.currencySymbol ?? "";
  const showLoader = enabled && isPending && !overview;

  return (
    <View
      style={[
        styles.section,
        !enabled && styles.sectionDisabled,
        showLoader && styles.sectionReservedHeight
      ]}
    >
      <View style={styles.sectionContent} collapsable={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEmoji}>💰</Text>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        </View>

        {!enabled ? (
          <Text style={styles.muted}>{disabledHint}</Text>
        ) : showLoader ? (
          <KpiGridSkeleton count={4} />
        ) : error ? (
          <Text style={styles.err}>{error}</Text>
        ) : overview ? (
          <View style={styles.kpiBlock}>
            <View style={styles.kpiRow}>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("financeScreen.balance")}
                  value={formatMoney(overview.balanceAllTime, curCode, curSym)}
                  deltaText={null}
                  sparklineValues={
                    balanceSeries.length > 1 ? balanceSeries : undefined
                  }
                  sparklineColor="#F97316"
                  variant="orange"
                />
              </View>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("financeScreen.revenuesMonth")}
                  value={formatMoney(
                    overview.month.totalRevenues,
                    curCode,
                    curSym
                  )}
                  deltaText={revDelta}
                  sparklineValues={revSeries.length > 1 ? revSeries : undefined}
                  sparklineColor="#3B82F6"
                  variant="blue"
                />
              </View>
            </View>
            <View style={[styles.kpiRow, styles.kpiRowSp]}>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("financeScreen.expensesMonth")}
                  value={formatMoney(
                    overview.month.totalExpenses,
                    curCode,
                    curSym
                  )}
                  deltaText={expDelta}
                  sparklineValues={expSeries.length > 1 ? expSeries : undefined}
                  sparklineColor="#EAB308"
                  variant="yellow"
                />
              </View>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("financeScreen.marginMonth")}
                  value={formatMoney(overview.month.netMargin, curCode, curSym)}
                  deltaText={marginDelta}
                  sparklineValues={netSeries.length > 1 ? netSeries : undefined}
                  sparklineColor="#22C55E"
                  variant="green"
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {enabled ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.sectionHitArea,
            pressed && styles.sectionPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel={sectionTitle}
        />
      ) : null}
    </View>
  );
}

/** Hauteur approximative de la grille 2×2 KPI (évite chevauchement des cartes voisines au chargement). */
const SECTION_RESERVED_MIN_HEIGHT = 400;

const styles = StyleSheet.create({
  section: {
    position: "relative",
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    ...mobileShadows.card
  },
  sectionReservedHeight: {
    minHeight: SECTION_RESERVED_MIN_HEIGHT
  },
  sectionContent: {
    width: "100%"
  },
  sectionHitArea: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: mobileRadius.md
  },
  sectionDisabled: { opacity: 0.55 },
  sectionPressed: { opacity: 0.92 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  sectionEmoji: { fontSize: 20 },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    flex: 1,
    color: mobileColors.textPrimary
  },
  kpiBlock: { marginTop: mobileSpacing.xs },
  kpiRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    alignItems: "stretch",
    width: "100%"
  },
  kpiRowSp: { marginTop: mobileSpacing.sm },
  kpiHalf: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignSelf: "stretch"
  },
  loader: { marginVertical: mobileSpacing.lg },
  muted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  err: {
    ...mobileTypography.meta,
    color: mobileColors.error
  }
});
