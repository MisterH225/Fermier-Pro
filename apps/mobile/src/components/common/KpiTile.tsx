import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RolePalette } from "./rolePalette";

type Props = {
  label: string;
  value: number | string;
  emoji?: string;
  bg: string;
  accent: string;
  palette: RolePalette;
  onPress?: () => void;
  testID?: string;
};

export function KpiTile({
  label,
  value,
  emoji,
  bg,
  accent,
  palette,
  onPress,
  testID
}: Props) {
  const content = (
    <>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: bg, borderRadius: palette.radiusCard },
          palette.shadowCard,
          pressed && { opacity: 0.9 }
        ]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        styles.tile,
        { backgroundColor: bg, borderRadius: palette.radiusCard },
        palette.shadowCard
      ]}
      accessibilityRole="text"
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "47%",
    padding: mobileSpacing.md,
    gap: 2
  },
  emoji: { fontSize: 18, marginBottom: 2 },
  value: { fontSize: 22, fontWeight: "700" },
  label: { ...mobileTypography.meta, marginTop: 4 }
});
