import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileTypography } from "../../theme/mobileTheme";

export const EXTENDED_MENU_TILE_WIDTH = 58;
export const EXTENDED_MENU_TILE_HEIGHT = 56;

/** @deprecated Utiliser EXTENDED_MENU_TILE_HEIGHT */
export const EXTENDED_MENU_TILE_SIZE = EXTENDED_MENU_TILE_HEIGHT;

type ExtendedMenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  badgeCount?: number;
};

/** Tuile icône + libellé (menu étendu « + »). */
export function ExtendedMenuItem({
  icon,
  label,
  onPress,
  accessibilityLabel,
  badgeCount
}: ExtendedMenuItemProps) {
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={mobileColors.onAccent} />
        {showBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTx}>
              {badgeCount > 99 ? "99+" : String(badgeCount)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: EXTENDED_MENU_TILE_WIDTH,
    minHeight: EXTENDED_MENU_TILE_HEIGHT,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 4
  },
  tilePressed: {
    opacity: 0.82,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  iconWrap: {
    position: "relative",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E53935",
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeTx: {
    color: mobileColors.onAccent,
    fontSize: 9,
    fontWeight: "800"
  },
  label: {
    ...mobileTypography.meta,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
    textAlign: "center"
  }
});
