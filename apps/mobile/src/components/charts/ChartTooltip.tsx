import { StyleSheet, Text, View } from "react-native";
import { mobileRadius, mobileSpacing, mobileTypography, mobileColors } from "../../theme/mobileTheme";

type Props = {
  value: string;
  left: number;
  top: number;
};

export function ChartTooltip({ value, left, top }: Props) {
  return (
    <View
      style={[
        styles.bubble,
        {
          left: Math.max(8, left - 48),
          top: Math.max(4, top - 36)
        }
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    backgroundColor: mobileColors.textPrimary,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.md,
    minWidth: 72,
    alignItems: "center",
    shadowColor: mobileColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  text: {
    ...mobileTypography.meta,
    color: mobileColors.background,
    fontWeight: "700"
  }
});
