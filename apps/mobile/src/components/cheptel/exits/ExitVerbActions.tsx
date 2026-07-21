import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import {
  LIVESTOCK_EXIT_VERB_KEYS,
  LIVESTOCK_EXIT_VERB_ORDER,
  type LivestockExitKind
} from "./livestockExitKind";

const KIND_ICONS: Record<LivestockExitKind, keyof typeof Ionicons.glyphMap> = {
  sale: "pricetag-outline",
  mortality: "skull-outline",
  transfer: "airplane-outline",
  slaughter: "cut-outline"
};

type Props = {
  onSelect: (kind: LivestockExitKind) => void;
  /** Masquer un kind (ex. animal déjà sorti). */
  hiddenKinds?: LivestockExitKind[];
};

/** Actions de sortie en verbes (alignées sur LivestockExitKind). */
export function ExitVerbActions({ onSelect, hiddenKinds = [] }: Props) {
  const { t } = useTranslation();
  const kinds = LIVESTOCK_EXIT_VERB_ORDER.filter(
    (k) => !hiddenKinds.includes(k)
  );

  return (
    <View style={styles.wrap} testID="exit-verb-actions">
      {kinds.map((kind) => {
        const meta = LIVESTOCK_EXIT_VERB_KEYS[kind];
        return (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={t(meta.a11yKey)}
            testID={`exit-verb-${kind}`}
            onPress={() => onSelect(kind)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Ionicons
              name={KIND_ICONS[kind]}
              size={18}
              color={mobileColors.accent}
            />
            <Text style={styles.label}>{t(meta.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.surfaceMuted,
    minHeight: 44
  },
  chipPressed: { opacity: 0.88 },
  label: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.sm
  }
});
