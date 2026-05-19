import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { GmqAnimalSummaryDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = { row: GmqAnimalSummaryDto };

export function GMQCard({ row }: Props) {
  const { t } = useTranslation();
  const statusIcon =
    row.status === "ok" ? "✅" : row.status === "warn" ? "⚠️" : "🔴";
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>{row.label}</Text>
        <Text style={styles.status}>{statusIcon}</Text>
      </View>
      <Text style={styles.line}>
        {t("cheptel.weight.entry")}: {row.entryWeight?.toFixed(1) ?? "—"} kg
      </Text>
      <Text style={styles.line}>
        {t("cheptel.weight.current")}: {row.currentWeight?.toFixed(1) ?? "—"} kg
      </Text>
      <Text style={styles.line}>
        {t("cheptel.weight.gain")}: {row.totalGainKg?.toFixed(1) ?? "—"} kg
      </Text>
      <Text style={styles.gmq}>
        GMQ {row.latestGmq != null ? Math.round(row.latestGmq) : "—"} g/j
        {row.targetGmqGPerDay != null
          ? ` · ${t("cheptel.weight.target")} ${Math.round(row.targetGmqGPerDay)}`
          : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  head: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontWeight: "700", fontSize: 15 },
  status: { fontSize: 16 },
  line: { ...mobileTypography.meta, marginTop: 4, color: mobileColors.textSecondary },
  gmq: { marginTop: 8, fontWeight: "700", color: mobileColors.accent }
});
