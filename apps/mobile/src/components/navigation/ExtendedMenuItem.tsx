import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

const CARD_BG = "#2C2C2E";

type ExtendedMenuItemProps = {
  emoji: string;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
};

export function ExtendedMenuItem({
  emoji,
  label,
  onPress,
  accessibilityLabel
}: ExtendedMenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.inner}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    minHeight: 100,
    width: "100%"
  },
  cardPressed: {
    opacity: 0.88
  },
  inner: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm
  },
  emoji: {
    fontSize: 28,
    lineHeight: 32
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center"
  }
});
