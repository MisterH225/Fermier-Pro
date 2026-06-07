import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  months: string[];
  labels: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function ChartMonthSelector({
  months,
  labels,
  selectedIndex,
  onSelect
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {months.map((month, i) => {
        const active = i === selectedIndex;
        return (
          <Pressable
            key={month}
            onPress={() => onSelect(i)}
            style={[styles.pill, active && styles.pillActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {labels[i] ?? month}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: mobileSpacing.xs,
    paddingVertical: mobileSpacing.xs
  },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.pill,
    backgroundColor: "transparent"
  },
  pillActive: {
    backgroundColor: mobileColors.surfaceMuted
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  labelActive: {
    color: mobileColors.textPrimary
  }
});
