import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { FilterPill } from "./types";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

const DEFAULT_ACTIVE_BG = "#1B3B2E";

type Props = {
  pills: FilterPill[];
  activeId: string;
  onChange: (id: string) => void;
  /** Couleur du pill actif (ex. Market = ton chaud). */
  activeBackground?: string;
};

export function EventListFilter({
  pills,
  activeId,
  onChange,
  activeBackground = DEFAULT_ACTIVE_BG
}: Props) {
  if (!pills.length) {
    return null;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {pills.map((p) => {
        const on = p.id === activeId;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            style={[styles.pill, on && { backgroundColor: activeBackground, borderColor: activeBackground }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.pillTx, on && styles.pillTxOn]} numberOfLines={1}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: mobileSpacing.sm,
    gap: mobileSpacing.sm,
    flexDirection: "row",
    alignItems: "center"
  },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    marginRight: mobileSpacing.sm
  },
  pillTx: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  pillTxOn: {
    color: "#FFFFFF"
  }
});
