import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type DashboardPeriodOption<T extends string = string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly DashboardPeriodOption<T>[];
  value: T;
  onChange: (key: T) => void;
  activeBackground: string;
  activeColor: string;
  idleBackground?: string;
  idleColor?: string;
};

/**
 * Sélecteur de période compact (mois / trimestre / année).
 * Partagé dashboard producteur (rentabilité) et acheteur (achats).
 */
export function DashboardPeriodPills<T extends string>({
  options,
  value,
  onChange,
  activeBackground,
  activeColor,
  idleBackground = "rgba(0,0,0,0.06)",
  idleColor
}: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const on = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            style={[
              styles.pill,
              {
                backgroundColor: on ? activeBackground : idleBackground
              }
            ]}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[
                styles.pillText,
                { color: on ? activeColor : idleColor ?? activeColor },
                on && styles.pillTextOn
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  pill: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill
  },
  pillText: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    fontWeight: "600"
  },
  pillTextOn: {
    fontWeight: "800"
  }
});
