import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import type { PigPriceIndexStatsDto } from "../../lib/api";
import { producerColors } from "../../theme/producerTheme";
import { buyerColors } from "../../theme/buyerTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  stats: PigPriceIndexStatsDto | undefined;
  category: string;
};

function deltaText(v: number | null): string {
  if (v == null || !Number.isFinite(v)) {
    return "—";
  }
  const sign = v > 0 ? "+" : "";
  const emoji = v > 0 ? "📈" : v < 0 ? "📉" : "➡️";
  return `${sign}${v.toFixed(1)}% ${emoji}`;
}

export function PriceStatsRow({ stats, category }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const fmt = (n: number | null): string => {
    if (n == null || !Number.isFinite(n)) {
      return "—";
    }
    return `${Math.round(n).toLocaleString(locale)}`;
  };

  const row =
    category === "all"
      ? stats?.rows[0]
      : stats?.rows.find((r) => r.category === category);

  if (!row) {
    return null;
  }

  const deltaColor =
    row.variation24h != null && row.variation24h > 0
      ? producerColors.primary
      : row.variation24h != null && row.variation24h < 0
        ? uiNamedColors.cE03131
        : uiNamedColors.c868E96;

  return (
    <View style={styles.grid}>
      <View style={styles.cell}>
        <Text style={styles.label}>{t("pigPriceIndex.statToday")}</Text>
        <Text style={styles.value}>{fmt(row.todayPrice)}</Text>
        <Text style={[styles.delta, { color: deltaColor }]}>
          {deltaText(row.variation24h)}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>{t("pigPriceIndex.statHigh")}</Text>
        <Text style={[styles.value, { color: uiNamedColors.c00C9A7 }]}>{fmt(row.high30d)}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>{t("pigPriceIndex.statLow")}</Text>
        <Text style={[styles.value, { color: uiNamedColors.cFF4757 }]}>{fmt(row.low30d)}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>{t("pigPriceIndex.statVolume")}</Text>
        <Text style={[styles.value, { color: buyerColors.primary }]}>{row.volume}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  cell: {
    width: "47%",
    backgroundColor: uiNamedColors.cF8F9FA,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    borderWidth: 1,
    borderColor: uiNamedColors.cE9ECEF
  },
  label: { ...mobileTypography.meta, color: uiNamedColors.c868E96, fontSize: mobileFontSize.xs },
  value: { ...mobileTypography.cardTitle, fontSize: mobileFontSize.lg, marginTop: 4 },
  delta: { ...mobileTypography.meta, marginTop: 2, fontWeight: "600" }
});
