import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { mobileRadius } from "../../theme/mobileTheme";

type NavItemProps = {
  emoji: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  /** Réduit l’empreinte pour une pill basse (hauteur homogène avec le bouton +). */
  dense?: boolean;
};

export function NavItem({
  emoji,
  active,
  onPress,
  accessibilityLabel,
  dense
}: NavItemProps) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const activeBg = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";

  const wrap = dense ? styles.iconWrapDense : styles.iconWrap;
  const hit = dense ? styles.hitDense : styles.hit;
  const emojiStyle = dense ? styles.emojiDense : styles.emoji;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [hit, pressed && { opacity: 0.85 }]}
    >
      <View style={[wrap, active && { backgroundColor: activeBg }]}>
        <Text style={[emojiStyle, { opacity: active ? 1 : 0.45 }]}>{emoji}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  hitDense: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapDense: {
    width: 36,
    height: 36,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  emoji: {
    fontSize: 22,
    lineHeight: 26
  },
  emojiDense: {
    fontSize: 19,
    lineHeight: 23
  }
});
