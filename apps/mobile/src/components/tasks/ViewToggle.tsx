import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskViewMode } from "./taskConstants";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  mode: TaskViewMode;
  onChange: (m: TaskViewMode) => void;
};

export function ViewToggle({ mode, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.btn, mode === "grid" && styles.btnOn]}
        onPress={() => onChange("grid")}
        accessibilityRole="button"
      >
        <Text style={[styles.tx, mode === "grid" && styles.txOn]}>📊</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, mode === "list" && styles.btnOn]}
        onPress={() => onChange("list")}
        accessibilityRole="button"
      >
        <Text style={[styles.tx, mode === "list" && styles.txOn]}>📋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    overflow: "hidden"
  },
  btn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  btnOn: {
    backgroundColor: mobileColors.textPrimary
  },
  tx: { fontSize: 16 },
  txOn: { opacity: 1 }
});
