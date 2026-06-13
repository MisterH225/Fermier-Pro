import { StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

export type CheptelStyleKpiCardProps = {
  icon: string;
  bg: string;
  accent: string;
  label: string;
  value: string;
  unit?: string;
  widget?: React.ReactNode;
};

export function CheptelStyleKpiCard({
  icon,
  bg,
  accent,
  label,
  value,
  unit,
  widget
}: CheptelStyleKpiCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={styles.topRow}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.valueCol}>
          <Text style={[styles.value, { color: accent }]}>{value}</Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
        {widget ? <View style={styles.widgetCol}>{widget}</View> : null}
      </View>
    </View>
  );
}

export const cheptelKpiGridStyles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  half: {
    width: "47%",
    flexGrow: 1,
    minWidth: "46%"
  }
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: mobileSpacing.md,
    minHeight: 120,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  icon: { fontSize: 18 },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    flex: 1
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  valueCol: { flex: 1 },
  value: { fontSize: 24, fontWeight: "800" },
  unit: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  widgetCol: { alignItems: "flex-end", justifyContent: "flex-end" }
});
