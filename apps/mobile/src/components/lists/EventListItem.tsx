import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EventItem } from "./types";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

function iconFor(item: EventItem): keyof typeof Ionicons.glyphMap {
  if (item.iconType === "custom" && item.customIcon) {
    return item.customIcon as keyof typeof Ionicons.glyphMap;
  }
  switch (item.iconType) {
    case "in":
      return "arrow-down";
    case "out":
      return "arrow-up";
    case "cancelled":
      return "close";
    case "check":
      return "checkmark";
    default:
      return "ellipse";
  }
}

function circleColors(item: EventItem): { bg: string; fg: string } {
  if (item.iconColor) {
    return { bg: `${item.iconColor}22`, fg: item.iconColor };
  }
  switch (item.iconType) {
    case "in":
      return { bg: "#DCFCE7", fg: mobileColors.success };
    case "out":
      return { bg: "#FEE2E2", fg: mobileColors.error };
    case "cancelled":
      return { bg: "#FFEDD5", fg: "#C2410C" };
    case "check":
      return { bg: mobileColors.surfaceMuted, fg: mobileColors.textSecondary };
    default:
      return { bg: mobileColors.surfaceMuted, fg: mobileColors.textSecondary };
  }
}

function valueColor(t: EventItem["valueType"]): string {
  if (t === "positive") return mobileColors.success;
  if (t === "negative") return mobileColors.error;
  return mobileColors.textPrimary;
}

type Props = {
  item: EventItem;
  onPress: () => void;
};

export function EventListItem({ item, onPress }: Props) {
  const { bg, fg } = circleColors(item);
  const icon = iconFor(item);
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={fg} />
        </View>
        <View style={styles.mid}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={styles.sub} numberOfLines={2}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          {item.value ? (
            <Text style={[styles.value, { color: valueColor(item.valueType) }]}>
              {item.value}
            </Text>
          ) : (
            <View style={{ height: 20 }} />
          )}
          <Text style={styles.date}>{item.date}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    ...mobileShadows.card
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  mid: { flex: 1, minWidth: 0 },
  title: {
    ...mobileTypography.body,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  sub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  right: { alignItems: "flex-end", minWidth: 96 },
  value: {
    fontSize: 15,
    fontWeight: "800"
  },
  date: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4,
    fontSize: 12
  }
});
