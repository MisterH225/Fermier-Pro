import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Item = { key: string; label: string };

type SegmentedControlProps = {
  items: Item[];
  activeKey: string;
  onChange: (key: string) => void;
};

export function SegmentedControl({
  items,
  activeKey,
  onChange
}: SegmentedControlProps) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onChange(item.key)}
            activeOpacity={0.9}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.pill,
    padding: 4
  },
  item: {
    flex: 1,
    minHeight: 40,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.sm
  },
  itemActive: {
    backgroundColor: mobileColors.background
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  labelActive: {
    color: mobileColors.textPrimary
  }
});
