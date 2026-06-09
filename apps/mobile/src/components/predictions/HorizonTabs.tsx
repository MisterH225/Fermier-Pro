import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PredictionHorizonKey } from "../../lib/api/predictions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const HORIZONS: PredictionHorizonKey[] = ["30j", "60j", "90j"];

type Props = {
  value: PredictionHorizonKey;
  onChange: (h: PredictionHorizonKey) => void;
};

export function HorizonTabs({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {HORIZONS.map((h) => {
        const active = h === value;
        return (
          <Pressable
            key={h}
            onPress={() => onChange(h)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {h}
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
    gap: mobileSpacing.xs,
    marginBottom: mobileSpacing.sm
  },
  tab: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  tabActive: {
    backgroundColor: mobileColors.accent
  },
  tabText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#fff"
  }
});
