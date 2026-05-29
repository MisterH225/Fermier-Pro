import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

export type PigPriceCategoryKey = "all" | "porcelet" | "croissance" | "charcutier" | "reproducteur";

const OPTIONS: { key: PigPriceCategoryKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "porcelet", label: "Porcelets 🐣" },
  { key: "croissance", label: "Croissance 📈" },
  { key: "charcutier", label: "Charcutier 🐷" },
  { key: "reproducteur", label: "Reproducteurs ♻️" }
];

type Props = {
  value: PigPriceCategoryKey;
  onChange: (key: PigPriceCategoryKey) => void;
};

export function CategorySelector({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: mobileSpacing.sm, paddingVertical: mobileSpacing.xs },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: "#F1F3F5",
    borderWidth: 1,
    borderColor: "#DEE2E6"
  },
  pillActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  pillText: { ...mobileTypography.meta, fontWeight: "600", color: "#495057" },
  pillTextActive: { color: "#fff" }
});
