import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FinanceCategoryDto } from "../../lib/api";
import { mobileColors, mobileTypography } from "../../theme/mobileTheme";
import { getFinanceCategoryVisual } from "./financeCategoryVisual";

const CIRCLE = 56;
const COLS = 4;

type Props = {
  categories: FinanceCategoryDto[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function FinanceCategoryGrid({
  categories,
  selectedId,
  onSelect
}: Props) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.grid}>
      {categories.map((c, index) => {
        const selected = selectedId === c.id;
        const visual = getFinanceCategoryVisual(c.key, index, c.icon);
        const showEmoji = visual.useEmoji && c.icon?.trim();

        return (
          <Pressable
            key={c.id}
            style={styles.cell}
            onPress={() => onSelect(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <View
              style={[
                styles.circle,
                { backgroundColor: visual.bg },
                selected && {
                  borderColor: visual.accent,
                  borderWidth: 2.5
                }
              ]}
            >
              {showEmoji ? (
                <Text style={styles.emoji}>{c.icon!.trim()}</Text>
              ) : (
                <Ionicons name={visual.icon} size={26} color={visual.accent} />
              )}
            </View>
            <Text
              style={[styles.label, selected && { color: visual.accent }]}
              numberOfLines={2}
            >
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
    marginHorizontal: -4
  },
  cell: {
    width: `${100 / COLS}%`,
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 14,
    minWidth: 0
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent"
  },
  emoji: {
    fontSize: 26
  },
  label: {
    ...mobileTypography.meta,
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    textAlign: "center",
    lineHeight: 14
  }
});
