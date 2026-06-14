import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { FarmProfitabilityDashboardDto } from "../../lib/api";
import {
  coerceFiniteNumber,
  formatOptionalNumber,
  formatOptionalPct,
  roundCoerced
} from "../../lib/coerceNumber";
import { formatFarmMoney as formatMoney } from "../../lib/formatMoney";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  data: FarmProfitabilityDashboardDto | undefined;
  isLoading: boolean;
  currencySymbol: string;
  onPressDetail?: () => void;
  onPeriodChange?: (period: "current_month" | "current_quarter" | "current_year") => void;
  period?: "current_month" | "current_quarter" | "current_year";
};

function trendLabel(delta: unknown): string | null {
  const n = coerceFiniteNumber(delta);
  if (n == null) return null;
  const sign = n >= 0 ? "↑" : "↓";
  return `${sign} ${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function RentabilityHeroCard({
  data,
  isLoading,
  currencySymbol,
  onPressDetail,
  onPeriodChange,
  period = "current_month"
}: Props) {
  const { t } = useTranslation();

  if (isLoading && !data) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  if (!data) {
    return null;
  }

  const insufficient = data.dataQuality === "insufficient";
  const netMargin = coerceFiniteNumber(data.netMargin);
  const netMarginPct = formatOptionalPct(data.netMarginPct);
  const grossMarginPct = formatOptionalPct(data.grossMarginPct);
  const costPerKg = roundCoerced(data.costPerKg);
  const marketPricePerKg = roundCoerced(data.marketPricePerKg);
  const breakevenPricePerKg = roundCoerced(data.breakevenPricePerKg);
  const isProfit = netMargin != null && netMargin > 0;
  const isLoss = netMargin != null && netMargin < 0;
  const bg = isLoss ? "#FEE2E2" : isProfit ? "#DCFCE7" : "#FEF3C7";
  const accent = isLoss ? "#DC2626" : isProfit ? "#16A34A" : "#D97706";

  const periods = [
    { key: "current_month" as const, label: t("profitability.periodMonth") },
    { key: "current_quarter" as const, label: t("profitability.periodQuarter") },
    { key: "current_year" as const, label: t("profitability.periodYear") }
  ];

  return (
    <Pressable
      style={[styles.card, { backgroundColor: bg }]}
      onPress={onPressDetail}
      disabled={!onPressDetail}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("profitability.heroTitle")}</Text>
        <View style={styles.periodRow}>
          {periods.map((p) => (
            <Pressable
              key={p.key}
              style={[
                styles.periodPill,
                period === p.key && styles.periodPillOn
              ]}
              onPress={() => onPeriodChange?.(p.key)}
            >
              <Text
                style={[
                  styles.periodPillText,
                  period === p.key && styles.periodPillTextOn
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {insufficient ? (
        <Text style={styles.insufficient}>
          {data.dataQualityMessage ?? t("profitability.insufficientData")}
        </Text>
      ) : (
        <>
          <Text style={[styles.mainValue, { color: accent }]}>
            {netMargin != null
              ? formatMoney(netMargin, data.currency, currencySymbol)
              : "—"}
          </Text>
          <Text style={styles.mainSub}>
            {t("profitability.netMarginLabel")}
            {netMarginPct ? ` · ${netMarginPct}` : ""}
            {trendLabel(data.trendNetMarginPctDelta)
              ? ` · ${trendLabel(data.trendNetMarginPctDelta)}`
              : ""}
          </Text>

          <View style={styles.miniRow}>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>{t("profitability.grossMargin")}</Text>
              <Text style={[styles.miniValue, { color: accent }]}>
                {data.grossMargin != null
                  ? formatMoney(data.grossMargin, data.currency, currencySymbol)
                  : "—"}
              </Text>
              {grossMarginPct ? (
                <Text style={styles.miniSub}>{grossMarginPct}</Text>
              ) : null}
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>{t("profitability.costPerKg")}</Text>
              <Text style={[styles.miniValue, { color: accent }]}>
                {costPerKg != null
                  ? `${costPerKg} ${currencySymbol}/kg`
                  : "—"}
              </Text>
              {marketPricePerKg != null ? (
                <Text style={styles.miniSub}>
                  {t("profitability.vsMarket", {
                    price: marketPricePerKg
                  })}
                </Text>
              ) : null}
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>{t("profitability.breakeven")}</Text>
              <Text style={[styles.miniValue, { color: accent }]}>
                {breakevenPricePerKg != null
                  ? `${breakevenPricePerKg} ${currencySymbol}/kg`
                  : "—"}
              </Text>
              <Text style={styles.miniSub}>{t("profitability.minPrice")}</Text>
            </View>
          </View>

          {data.activeBatchesCount > 0 ? (
            <Text style={styles.batchSummary}>
              {t("profitability.batchSummary", {
                count: data.activeBatchesCount,
                best: data.bestBatch?.name ?? "—",
                bestPct: formatOptionalNumber(data.bestBatch?.netMarginPct, 0) ?? "—",
                worst: data.worstBatch?.name ?? "—",
                worstPct:
                  formatOptionalNumber(data.worstBatch?.netMarginPct, 0) ?? "—"
              })}
            </Text>
          ) : null}

          {onPressDetail ? (
            <Text style={styles.cta}>{t("profitability.viewDetail")} →</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    ...mobileShadows.card,
    width: "100%"
  },
  cardLoading: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center"
  },
  headerRow: { gap: mobileSpacing.sm },
  title: {
    ...mobileTypography.cardTitle,
    fontWeight: "800"
  },
  periodRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)"
  },
  periodPillOn: { backgroundColor: mobileColors.textPrimary },
  periodPillText: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  periodPillTextOn: { color: "#fff" },
  insufficient: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md
  },
  mainValue: {
    fontSize: 32,
    fontWeight: "900",
    marginTop: mobileSpacing.md
  },
  mainSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  miniRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.lg
  },
  miniKpi: { flex: 1, minWidth: 0 },
  miniLabel: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  miniValue: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2
  },
  miniSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  batchSummary: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md
  },
  cta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent,
    marginTop: mobileSpacing.sm
  }
});
