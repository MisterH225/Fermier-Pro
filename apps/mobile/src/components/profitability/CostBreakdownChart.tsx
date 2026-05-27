import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ProfitabilityPeriodDto } from "../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatProfitMoney } from "./profitabilityFormat";

type Props = {
  data: ProfitabilityPeriodDto;
};

export function CostBreakdownChart({ data }: Props) {
  const { t } = useTranslation();
  const rows = data.costBreakdown;
  const maxPct = Math.max(...rows.map((r) => r.pctOfTotal), 1);

  return (
    <View>
      <Text style={styles.title}>{t("profitability.costBreakdownTitle")}</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.rowHead}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.amount}>
              {formatProfitMoney(row.amount, data.currency, data.currencySymbol)}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(row.pctOfTotal / maxPct) * 100}%`,
                  backgroundColor: row.color
                }
              ]}
            />
          </View>
          <View style={styles.rowFoot}>
            <Text style={styles.pct}>{row.pctOfTotal.toFixed(0)}%</Text>
            <Text style={styles.perKg}>
              {row.costPerKg != null
                ? `${formatProfitMoney(row.costPerKg, data.currency, data.currencySymbol)}/kg`
                : "—"}
            </Text>
          </View>
        </View>
      ))}
      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 2 }]}>{t("profitability.colPost")}</Text>
        <Text style={styles.th}>{t("profitability.colAmount")}</Text>
        <Text style={styles.th}>{t("profitability.colPct")}</Text>
        <Text style={styles.th}>{t("profitability.colPerKg")}</Text>
      </View>
      {rows.map((row) => (
        <View key={`t-${row.key}`} style={styles.tr}>
          <Text style={[styles.td, { flex: 2 }]}>{row.label}</Text>
          <Text style={styles.td}>
            {formatProfitMoney(row.amount, data.currency, data.currencySymbol)}
          </Text>
          <Text style={styles.td}>{row.pctOfTotal.toFixed(0)}%</Text>
          <Text style={styles.td}>
            {row.costPerKg != null
              ? formatProfitMoney(row.costPerKg, data.currency, data.currencySymbol)
              : "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...mobileTypography.sectionTitle, marginBottom: mobileSpacing.md },
  row: { marginBottom: mobileSpacing.md },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  label: { ...mobileTypography.body, fontWeight: "500" },
  amount: { ...mobileTypography.meta },
  barTrack: {
    height: 10,
    backgroundColor: mobileColors.border,
    borderRadius: 5,
    overflow: "hidden"
  },
  barFill: { height: "100%", borderRadius: 5 },
  rowFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2
  },
  pct: { ...mobileTypography.meta },
  perKg: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  tableHead: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: mobileColors.border,
    paddingTop: mobileSpacing.sm,
    marginTop: mobileSpacing.md
  },
  th: {
    flex: 1,
    ...mobileTypography.meta,
    fontWeight: "600"
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  td: { flex: 1, ...mobileTypography.meta }
});
