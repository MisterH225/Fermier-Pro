import { StyleSheet, Text, View } from "react-native";
import type { FarmDiseasesOverviewDto } from "../../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

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
  { key: "active", icon: "🤒", bg: "#FFF3E0", accent: "#FF8C00" },
  { key: "resolved", icon: "✅", bg: "#E8F5E9", accent: "#2E7D32" },
  { key: "rate", icon: "📊", bg: "#EDE7F6", accent: "#6A1B9A" },
  { key: "isolation", icon: "🔒", bg: "#FCE4EC", accent: "#C2185B" }
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
    borderRadius: 20,
    padding: mobileSpacing.md,
    minHeight: 96
  },
  icon: { fontSize: 20, marginBottom: mobileSpacing.xs },
  title: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: mobileSpacing.xs
  }
});
