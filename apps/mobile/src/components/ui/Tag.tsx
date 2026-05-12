import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type TagTone = "neutral" | "success" | "warning" | "danger";

type TagProps = {
  label: string;
  tone?: TagTone;
};

export function Tag({ label, tone = "neutral" }: TagProps) {
  return (
    <View style={[styles.base, toneBoxStyles[tone]]}>
      <Text style={[styles.text, toneTextStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 6
  },
  text: {
    fontSize: 12,
    fontWeight: "600"
  }
});

const toneBoxStyles = StyleSheet.create({
  neutral: { backgroundColor: mobileColors.surfaceMuted },
  success: { backgroundColor: "#EAF7EE" },
  warning: { backgroundColor: "#FEF6E6" },
  danger: { backgroundColor: "#FDECEC" }
});

const toneTextStyles = StyleSheet.create({
  neutral: { color: mobileColors.textSecondary },
  success: { color: mobileColors.success },
  warning: { color: mobileColors.warning },
  danger: { color: mobileColors.error }
});
