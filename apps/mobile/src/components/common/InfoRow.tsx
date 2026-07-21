import { StyleSheet, Text, View } from "react-native";
import { mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import type { RolePalette } from "./rolePalette";

type Props = {
  label: string;
  value: string;
  palette: RolePalette;
};

export function InfoRow({ label, value, palette }: Props) {
  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: palette.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  label: { ...mobileTypography.meta },
  value: { fontWeight: "500", fontSize: mobileFontSize.md }
});
