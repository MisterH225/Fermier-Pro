import { StyleSheet, Text } from "react-native";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RolePalette } from "./rolePalette";

type Props = {
  label: string;
  palette: RolePalette;
};

export function SectionHeader({ label, palette }: Props) {
  return (
    <Text
      style={[styles.header, { color: palette.textSecondary }]}
      accessibilityRole="header"
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    ...mobileTypography.meta,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xs
  }
});
