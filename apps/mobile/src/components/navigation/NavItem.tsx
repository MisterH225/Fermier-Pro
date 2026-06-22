import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { mobileColors, mobileRadius, mobileTypography } from "../../theme/mobileTheme";

type NavItemProps = {
  emoji: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  /** Libellé affiché sous l’emoji (barre principale). */
  label?: string;
  /** Réduit l’empreinte pour une pill basse (hauteur homogène avec le bouton +). */
  dense?: boolean;
  badgeCount?: number;
  testID?: string;
};

export function NavItem({
  emoji,
  active,
  onPress,
  accessibilityLabel,
  label,
  dense,
  badgeCount,
  testID
}: NavItemProps) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const activeBg = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
  const labelColor = active
    ? dark
      ? mobileColors.onAccent
      : mobileColors.textPrimary
    : dark
      ? "rgba(255,255,255,0.55)"
      : "rgba(0,0,0,0.45)";

  const wrap = dense ? styles.iconWrapDense : styles.iconWrap;
  const hit = dense ? styles.hitDense : styles.hit;
  const emojiStyle = dense ? styles.emojiDense : styles.emoji;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [hit, pressed && { opacity: 0.85 }]}
    >
      <View style={[wrap, active && { backgroundColor: activeBg }]}>
        <Text style={[emojiStyle, { opacity: active ? 1 : 0.45 }]}>{emoji}</Text>
        {badgeCount && badgeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTx}>
              {badgeCount > 99 ? "99+" : String(badgeCount)}
            </Text>
          </View>
        ) : null}
      </View>
      {label ? (
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
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
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    gap: 1
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapDense: {
    width: 34,
    height: 30,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E03131",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  badgeTx: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11
  },
  emoji: {
    fontSize: 22,
    lineHeight: 26
  },
  emojiDense: {
    fontSize: 18,
    lineHeight: 22
  },
  label: {
    ...mobileTypography.meta,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 56
  }
});
