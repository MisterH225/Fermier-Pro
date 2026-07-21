import { StyleSheet, Text, View } from "react-native";
import type { FarmDiseasesOverviewDto } from "../../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileKpiPalette, mobileRadius, mobileFontSize } from "../../../theme/mobileTheme";
import { merchantColors } from "../../../theme/merchantTheme";
import { uiNamedColors } from "../../../theme/uiNamedColors";

type Props = {
  overview: FarmDiseasesOverviewDto | undefined;
  labels: {
    active: string;
    resolved: string;
    rate: string;
    isolation: string;
  };
};

const CARDS = [
  { key: "active", icon: "🤒", bg: mobileStatusSurfaces.warningBg, accent: mobileKpiPalette.gestation.accent },
  { key: "resolved", icon: "✅", bg: mobileStatusSurfaces.positiveBg, accent: mobileStatusSurfaces.positiveText },
  { key: "rate", icon: "📊", bg: uiNamedColors.cEDE7F6, accent: uiNamedColors.c6A1B9A },
  { key: "isolation", icon: "🔒", bg: merchantColors.roseSoftBg, accent: uiNamedColors.cC2185B }
] as const;

export function DiseaseKPICards({ overview, labels }: Props) {
  const kpis = overview?.kpis;
  const values: Record<(typeof CARDS)[number]["key"], string> = {
    active: String(kpis?.activeCases ?? "—"),
    resolved: String(kpis?.resolvedThisMonth ?? "—"),
    rate: kpis?.diseaseRatePct != null ? `${kpis.diseaseRatePct}%` : "—",
    isolation: String(kpis?.isolationCount ?? "—")
  };
  const labelMap = {
    active: labels.active,
    resolved: labels.resolved,
    rate: labels.rate,
    isolation: labels.isolation
  };

  return (
    <View style={styles.grid}>
      {CARDS.map((card) => (
        <View
          key={card.key}
          style={[styles.card, { backgroundColor: card.bg }]}
        >
          <Text style={styles.icon}>{card.icon}</Text>
          <Text style={styles.title}>{labelMap[card.key]}</Text>
          <Text style={[styles.value, { color: card.accent }]}>
            {values[card.key]}
          </Text>
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
    width: "47%",
    flexGrow: 1,
    minWidth: "46%",
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing.md,
    minHeight: 96
  },
  icon: { fontSize: mobileFontSize.xl, marginBottom: mobileSpacing.xs },
  title: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  value: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    marginTop: mobileSpacing.xs
  }
});
