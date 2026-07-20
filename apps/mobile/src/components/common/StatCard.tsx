import { StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RolePalette } from "./rolePalette";

type Props = {
  label: string;
  value: string | number;
  palette: RolePalette;
  hint?: string;
};

export function StatCard({ label, value, palette, hint }: Props) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.primaryLight,
          borderRadius: palette.radiusButton
        }
      ]}
    >
      <Text style={[styles.value, { color: palette.primary }]}>{value}</Text>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      {hint ? (
        <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    padding: mobileSpacing.md,
    gap: 2
  },
  value: { fontSize: 20, fontWeight: "800" },
  label: {
    ...mobileTypography.meta,
    textAlign: "center",
    marginTop: 2
  },
  hint: { ...mobileTypography.meta, fontSize: 11, textAlign: "center" }
});
