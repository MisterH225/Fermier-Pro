import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EventItem } from "./types";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileFontSize } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

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
      return { bg: mobileStatusSurfaces.successBg, fg: mobileColors.success };
    case "out":
      return { bg: mobileStatusSurfaces.errorBg, fg: mobileColors.error };
    case "cancelled":
      return { bg: uiNamedColors.cFFEDD5, fg: uiNamedColors.cC2410C };
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
          {typeof item.subtitle === "string" && item.subtitle ? (
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
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
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
    borderRadius: mobileRadius.xl,
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
    fontSize: mobileFontSize.md,
    fontWeight: "800"
  },
  date: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4,
    fontSize: mobileFontSize.sm
  }
});
