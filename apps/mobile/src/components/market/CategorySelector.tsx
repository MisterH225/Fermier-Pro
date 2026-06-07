import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

export type PigPriceCategoryKey = "all" | "porcelet" | "croissance" | "charcutier" | "reproducteur";

type Props = {
  value: PigPriceCategoryKey;
  onChange: (key: PigPriceCategoryKey) => void;
};

export function CategorySelector({ value, onChange }: Props) {
  const { t } = useTranslation();

  const options: { key: PigPriceCategoryKey; label: string }[] = [
    { key: "all", label: t("pigPriceIndex.categoryAll") },
    { key: "porcelet", label: t("pigPriceIndex.categoryPorcelet") },
    { key: "croissance", label: t("pigPriceIndex.categoryCroissance") },
    { key: "charcutier", label: t("pigPriceIndex.categoryCharcutier") },
    { key: "reproducteur", label: t("pigPriceIndex.categoryReproducteur") }
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
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
