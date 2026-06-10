import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { BatchProfitabilityDto } from "../../lib/api";
import { formatFarmMoney as formatMoney } from "../../lib/formatMoney";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

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
  const fmt = (n: number | null | undefined) =>
    n != null ? formatMoney(n, cur, currencySymbol) : "—";

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

      {(r.revenues ?? 0) > 0 || (r.costsTotal ?? 0) > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profitability.realized")}</Text>
          {metricRow(t("profitability.revenues"), fmt(r.revenues))}
          {metricRow(t("profitability.costs"), fmt(r.costsTotal))}
          {metricRow(
            t("profitability.grossMargin"),
            `${fmt(r.grossMargin)}${r.grossMarginPct != null ? ` (${r.grossMarginPct.toFixed(1)}%)` : ""}`
          )}
          {metricRow(
            t("profitability.netMargin"),
            `${fmt(r.netMargin)}${r.netMarginPct != null ? ` (${r.netMarginPct.toFixed(1)}%)` : ""}`
          )}
          {metricRow(
            t("profitability.costPerKg"),
            r.costPerKg != null
              ? `${Math.round(r.costPerKg)} ${currencySymbol}/kg`
              : "—"
          )}
          {r.icActual != null
            ? metricRow(t("profitability.icActual"), r.icActual.toFixed(2))
            : null}
          {r.gmqActual != null
            ? metricRow(
                t("profitability.gmqActual"),
                `${Math.round(r.gmqActual)} g/j`
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
              `${fmt(p.netMargin)}${p.netMarginPct != null ? ` (${p.netMarginPct.toFixed(1)}%)` : ""}`
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
              `${fmt(batch.combined.netMargin)}${batch.combined.netMarginPct != null ? ` (${batch.combined.netMarginPct.toFixed(1)}%)` : ""}`
            )}
            {metricRow(
              "ROI",
              batch.combined.roi != null
                ? `${batch.combined.roi.toFixed(1)}%`
                : "—"
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
            `${fmt(r.netMargin)}${r.netMarginPct != null ? ` (${r.netMarginPct.toFixed(1)}%)` : ""}`
          )}
          <Text style={styles.result}>
            {(r.netMargin ?? 0) >= 0
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
    borderRadius: 999
  },
  badgeOpen: { backgroundColor: "#DBEAFE" },
  badgeClosed: { backgroundColor: "#E5E7EB" },
  badgeText: { ...mobileTypography.meta, fontWeight: "700" },
  section: { marginTop: mobileSpacing.md },
  combinedSection: {
    backgroundColor: "#F0FDF4",
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
