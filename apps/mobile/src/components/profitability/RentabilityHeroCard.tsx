import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { FarmProfitabilityDashboardDto } from "../../lib/api";
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

function trendLabel(delta: number | null | undefined): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const sign = delta >= 0 ? "↑" : "↓";
  return `${sign} ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
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
  const netMargin = data.netMargin;
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
            {data.netMarginPct != null
              ? ` · ${data.netMarginPct.toFixed(1)}%`
              : ""}
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
              {data.grossMarginPct != null ? (
                <Text style={styles.miniSub}>{data.grossMarginPct.toFixed(1)}%</Text>
              ) : null}
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>{t("profitability.costPerKg")}</Text>
              <Text style={[styles.miniValue, { color: accent }]}>
                {data.costPerKg != null
                  ? `${Math.round(data.costPerKg)} ${currencySymbol}/kg`
                  : "—"}
              </Text>
              {data.marketPricePerKg != null ? (
                <Text style={styles.miniSub}>
                  {t("profitability.vsMarket", {
                    price: Math.round(data.marketPricePerKg)
                  })}
                </Text>
              ) : null}
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>{t("profitability.breakeven")}</Text>
              <Text style={[styles.miniValue, { color: accent }]}>
                {data.breakevenPricePerKg != null
                  ? `${Math.round(data.breakevenPricePerKg)} ${currencySymbol}/kg`
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
                bestPct: data.bestBatch?.netMarginPct?.toFixed(0) ?? "—",
                worst: data.worstBatch?.name ?? "—",
                worstPct: data.worstBatch?.netMarginPct?.toFixed(0) ?? "—"
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
