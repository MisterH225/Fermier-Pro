import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ProfitabilityPeriodDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatProfitMoney } from "./profitabilityFormat";

type Props = {
  data: ProfitabilityPeriodDto;
};

export function ProfitabilityKPICards({ data }: Props) {
  const { t } = useTranslation();
  const cur = data.currency;
  const sym = data.currencySymbol;
  const margin = data.marginPerKg;
  const marginPositive = margin != null && margin >= 0;

  const cards = [
    {
      key: "cost",
      icon: "💰",
      label: t("profitability.kpiCostPerKgSold"),
      value: formatProfitMoney(data.costPerKgSold, cur, sym),
      sub: t("profitability.realData"),
      bg: "#EEF4FF",
      accent: "#2B7FFF"
    },
    {
      key: "price",
      icon: "📈",
      label: t("profitability.kpiAvgSalePrice"),
      value: formatProfitMoney(data.avgSalePricePerKg, cur, sym),
      sub: null,
      bg: "#E8F5E9",
      accent: "#2E7D32"
    },
    {
      key: "margin",
      icon: "💹",
      label: t("profitability.kpiMargin"),
      value: formatProfitMoney(margin, cur, sym),
      sub:
        margin != null
          ? marginPositive
            ? t("profitability.profitable")
            : t("profitability.notProfitable")
          : null,
      bg: marginPositive ? "#E8F5E9" : "#FFEBEE",
      accent: marginPositive ? "#2E7D32" : "#C62828"
    },
    {
      key: "herd",
      icon: "🐷",
      label: t("profitability.kpiHerdValue"),
      value: formatProfitMoney(data.herdValueEstimated, cur, sym),
      sub: t("profitability.estimated"),
      bg: "#FFF3E0",
      accent: "#FF8C00"
    }
  ];

  return (
    <View style={styles.grid}>
      {cards.map((c) => (
        <View
          key={c.key}
          style={[styles.card, { backgroundColor: c.bg, borderColor: c.accent }]}
        >
          <Text style={styles.icon}>{c.icon}</Text>
          <Text style={styles.label}>{c.label}</Text>
          <Text style={[styles.value, { color: c.accent }]}>{c.value}</Text>
          {c.sub ? <Text style={styles.sub}>{c.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  card: {
    width: "48%",
    flexGrow: 1,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    padding: mobileSpacing.md,
    minWidth: 140
  },
  icon: { fontSize: 22, marginBottom: 4 },
  label: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  value: {
    ...mobileTypography.sectionTitle,
    fontSize: 18,
    marginTop: 4
  },
  sub: {
    ...mobileTypography.meta,
    marginTop: 4,
    color: mobileColors.textSecondary
  }
});
