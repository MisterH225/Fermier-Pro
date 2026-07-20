import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Item = { key: string; label: string };

export type SegmentedControlPalette = {
  track: string;
  activeBg: string;
  activeLabel: string;
  inactiveLabel: string;
  /** Rayon du track (maquette Marché = 14). */
  trackRadius?: number;
  /** Rayon de la pastille active (maquette = 11). */
  pillRadius?: number;
};

type SegmentedControlProps = {
  items: Item[];
  activeKey: string;
  onChange: (key: string) => void;
  /** Palette optionnelle (ex. style « seg » acheteur). */
  palette?: SegmentedControlPalette;
};

export function SegmentedControl({
  items,
  activeKey,
  onChange,
  palette
}: SegmentedControlProps) {
  const trackRadius = palette?.trackRadius ?? mobileRadius.pill;
  const pillRadius = palette?.pillRadius ?? mobileRadius.pill;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette?.track ?? mobileColors.surface,
          borderRadius: trackRadius
        }
      ]}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.item,
              { borderRadius: pillRadius },
              active && styles.itemActive,
              active && {
                backgroundColor: palette?.activeBg ?? mobileColors.background
              }
            ]}
            onPress={() => onChange(item.key)}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.label,
                {
                  color: palette?.inactiveLabel ?? mobileColors.textSecondary
                },
                active && styles.labelActive,
                active && {
                  color: palette?.activeLabel ?? mobileColors.textPrimary
                }
              ]}
            >
              {item.label}
            </Text>
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
    minHeight: 36,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 8
  },
  itemActive: {
    backgroundColor: mobileColors.background,
    shadowColor: mobileColors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2
  },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    fontSize: 12,
    color: mobileColors.textSecondary
  },
  labelActive: {
    color: mobileColors.textPrimary,
    fontWeight: "700"
  }
});
