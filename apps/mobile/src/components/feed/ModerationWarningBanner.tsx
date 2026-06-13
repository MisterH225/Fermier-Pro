import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  message: string;
  severity?: "low" | "medium" | "high" | null;
};

export function ModerationWarningBanner({ message, severity = "low" }: Props) {
  const bg =
    severity === "high"
      ? "#FEE2E2"
      : severity === "medium"
        ? "#FEF3C7"
        : "#EFF6FF";
  const color =
    severity === "high"
      ? "#B91C1C"
      : severity === "medium"
        ? "#92400E"
        : mobileColors.textSecondary;

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  text: {
    ...mobileTypography.meta,
    fontSize: 12,
    lineHeight: 16
  }
});
