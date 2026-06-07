import { ScrollView, StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

export type ChartLegendItem = {
  key: string;
  label: string;
  color: string;
};

type Props = {
  items: ChartLegendItem[];
};

export function ChartLegend({ items }: Props) {
  if (!items.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs
  },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    maxWidth: 140
  }
});
