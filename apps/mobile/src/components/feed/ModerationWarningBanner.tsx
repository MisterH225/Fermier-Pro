import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileFontSize } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";
import { merchantColors } from "../../theme/merchantTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  message: string;
  severity?: "low" | "medium" | "high" | null;
};

export function ModerationWarningBanner({ message, severity = "low" }: Props) {
  const bg =
    severity === "high"
      ? mobileStatusSurfaces.errorBg
      : severity === "medium"
        ? producerColors.kpiAmberSoft
        : uiNamedColors.cEFF6FF;
  const color =
    severity === "high"
      ? producerColors.dangerStrong
      : severity === "medium"
        ? merchantColors.amberText
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
    fontSize: mobileFontSize.sm,
    lineHeight: 16
  }
});
