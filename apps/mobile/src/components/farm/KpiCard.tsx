import { StyleSheet, Text, View } from "react-native";
import { Card } from "../ui/Card";
import { mobileColors, mobileTypography } from "../../theme/mobileTheme";

type KpiCardProps = {
  label: string;
  value: string;
  tone?: "normal" | "success" | "warning" | "danger";
};

export function KpiCard({ label, value, tone = "normal" }: KpiCardProps) {
  return (
    <Card>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, toneStyles[tone]]}>{value}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8
  },
  value: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700"
  }
});

const toneStyles = StyleSheet.create({
  normal: { color: mobileColors.textPrimary },
  success: { color: mobileColors.success },
  warning: { color: mobileColors.warning },
  danger: { color: mobileColors.error }
});
