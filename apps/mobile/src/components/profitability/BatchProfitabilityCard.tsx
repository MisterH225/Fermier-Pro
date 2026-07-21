import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { BatchProfitabilityDto } from "../../lib/api";
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
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { merchantColors } from "../../theme/merchantTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  batch: BatchProfitabilityDto;
  currencySymbol: string;
};

function metricRow(label: string, value: string) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function BatchProfitabilityCard({ batch, currencySymbol }: Props) {
  const { t } = useTranslation();
  const r = batch.realized;
  const p = batch.projected;
  const cur = batch.currency;
  const fmt = (n: number | string | null | undefined) =>
    n != null ? formatMoney(n, cur, currencySymbol) : "—";
  const fmtPct = (value: unknown) => {
    const pct = formatOptionalPct(value);
    return pct ? ` (${pct})` : "";
  };
  const hasRealized =
    (coerceFiniteNumber(r.revenues) ?? 0) > 0 ||
    (coerceFiniteNumber(r.costsTotal) ?? 0) > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{batch.batchName}</Text>
          <Text style={styles.meta}>
            {batch.categoryKey ?? "—"} · {batch.headcount}{" "}
            {t("profitability.animals")}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            batch.status === "closed" ? styles.badgeClosed : styles.badgeOpen
          ]}
        >
          <Text style={styles.badgeText}>
            {batch.status === "closed"
              ? t("profitability.batchClosed")
              : t("profitability.batchOpen")}
          </Text>
        </View>
      </View>

      {batch.dataQualityMessage ? (
        <Text style={styles.warn}>{batch.dataQualityMessage}</Text>
      ) : null}

      {hasRealized ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profitability.realized")}</Text>
          {metricRow(t("profitability.revenues"), fmt(r.revenues))}
          {metricRow(t("profitability.costs"), fmt(r.costsTotal))}
          {metricRow(
            t("profitability.grossMargin"),
            `${fmt(r.grossMargin)}${fmtPct(r.grossMarginPct)}`
          )}
          {metricRow(
            t("profitability.netMargin"),
            `${fmt(r.netMargin)}${fmtPct(r.netMarginPct)}`
          )}
          {metricRow(
            t("profitability.costPerKg"),
            roundCoerced(r.costPerKg) != null
              ? `${roundCoerced(r.costPerKg)} ${currencySymbol}/kg`
              : "—"
          )}
          {formatOptionalNumber(r.icActual, 2)
            ? metricRow(
                t("profitability.icActual"),
                formatOptionalNumber(r.icActual, 2)!
              )
            : null}
          {roundCoerced(r.gmqActual) != null
            ? metricRow(
                t("profitability.gmqActual"),
                `${roundCoerced(r.gmqActual)} g/j`
              )
            : null}
        </View>
      ) : null}

      {batch.status === "open" && batch.animalsRemaining > 0 ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("profitability.projected")}
            </Text>
            {metricRow(t("profitability.revenues"), fmt(p.revenues))}
            {metricRow(t("profitability.costs"), fmt(p.costsTotal))}
            {metricRow(
              t("profitability.netMargin"),
              `${fmt(p.netMargin)}${fmtPct(p.netMarginPct)}`
            )}
            {p.remainingDaysEstimate != null
              ? metricRow(
                  t("profitability.remainingDays"),
                  String(p.remainingDaysEstimate)
                )
              : null}
          </View>
          <View style={[styles.section, styles.combinedSection]}>
            <Text style={styles.sectionTitle}>
              {t("profitability.combinedTotal")}
            </Text>
            {metricRow(t("profitability.revenues"), fmt(batch.combined.revenues))}
            {metricRow(
              t("profitability.netMargin"),
              `${fmt(batch.combined.netMargin)}${fmtPct(batch.combined.netMarginPct)}`
            )}
            {metricRow(
              "ROI",
              formatOptionalPct(batch.combined.roi) ?? "—"
            )}
          </View>
        </>
      ) : null}

      {batch.status === "closed" ? (
        <View style={[styles.section, styles.combinedSection]}>
          <Text style={styles.sectionTitle}>{t("profitability.finalSummary")}</Text>
          {metricRow(
            t("profitability.duration"),
            r.durationDays != null ? `${r.durationDays} j` : "—"
          )}
          {metricRow(
            t("profitability.animalsSold"),
            `${batch.animalsSold} / ${batch.headcount}`
          )}
          {metricRow(
            t("profitability.netMargin"),
            `${fmt(r.netMargin)}${fmtPct(r.netMarginPct)}`
          )}
          <Text style={styles.result}>
            {(coerceFiniteNumber(r.netMargin) ?? 0) >= 0
              ? t("profitability.resultProfit")
              : t("profitability.resultLoss")}
          </Text>
        </View>
      ) : null}

      {batch.warnings.map((w) => (
        <Text key={w} style={styles.warn}>
          {w}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm
  },
  name: { ...mobileTypography.cardTitle, fontWeight: "800" },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill
  },
  badgeOpen: { backgroundColor: merchantColors.blueSoftBg },
  badgeClosed: { backgroundColor: uiNamedColors.cE5E7EB },
  badgeText: { ...mobileTypography.meta, fontWeight: "700" },
  section: { marginTop: mobileSpacing.md },
  combinedSection: {
    backgroundColor: uiNamedColors.cF0FDF4,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  sectionTitle: {
    ...mobileTypography.meta,
    fontWeight: "800",
    marginBottom: mobileSpacing.xs
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  metricLabel: { ...mobileTypography.body, color: mobileColors.textSecondary },
  metricValue: { ...mobileTypography.body, fontWeight: "700" },
  warn: {
    ...mobileTypography.meta,
    color: mobileColors.warning,
    marginTop: mobileSpacing.sm
  },
  result: {
    ...mobileTypography.body,
    fontWeight: "800",
    marginTop: mobileSpacing.sm
  }
});
