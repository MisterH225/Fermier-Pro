import { useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { OnboardingPenLayoutPreview } from "../../../components/onboarding/OnboardingPenLayoutPreview";
import type { useOnboarding } from "../../../hooks/useOnboarding";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";

type Props = { ob: ReturnType<typeof useOnboarding> };

function parsePosInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function parseNonNeg(raw: string): number {
  const t = raw.trim();
  if (!t) {
    return 0;
  }
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function Step4Pens({ ob }: Props) {
  const { t } = useTranslation();
  const { form, patch, totalPens, totalCapacity, occupancyPct } = ob;

  const layoutNums = useMemo(
    () => ({
      buildings: parsePosInt(form.buildingsCount),
      pens: parsePosInt(form.pensPerBuilding),
      capacity: parsePosInt(form.maxPigsPerPen),
      females: parseNonNeg(form.femaleBreeders),
      males: parseNonNeg(form.maleBreeders),
      starter: parseNonNeg(form.starterHeadcount),
      fattening: parseNonNeg(form.fatteningHeadcount)
    }),
    [form]
  );
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("onboarding.step4.title")}</Text>
      <Text style={styles.sub}>{t("onboarding.step4.subtitle")}</Text>

      <Text style={styles.label}>{t("onboarding.step4.buildings")} *</Text>
      <TextInput
        style={styles.input}
        value={form.buildingsCount}
        onChangeText={(buildingsCount) => patch({ buildingsCount })}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t("onboarding.step4.pensPerBuilding")} *</Text>
      <TextInput
        style={styles.input}
        value={form.pensPerBuilding}
        onChangeText={(pensPerBuilding) => patch({ pensPerBuilding })}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t("onboarding.step4.capacity")} *</Text>
      <Text style={styles.helper}>{t("onboarding.step4.capacityHelper")}</Text>
      <TextInput
        style={styles.input}
        value={form.maxPigsPerPen}
        onChangeText={(maxPigsPerPen) => patch({ maxPigsPerPen })}
        keyboardType="number-pad"
      />

      <Text style={styles.layoutHint}>{t("onboarding.step4.layoutHint")}</Text>

      <OnboardingPenLayoutPreview
        buildingsCount={layoutNums.buildings}
        pensPerBuilding={layoutNums.pens}
        maxPigsPerPen={layoutNums.capacity}
        femaleCount={layoutNums.females}
        maleCount={layoutNums.males}
        starterCount={layoutNums.starter}
        fatteningCount={layoutNums.fattening}
      />

      <View style={styles.preview}>
        <Text style={styles.previewLine}>
          {t("onboarding.step4.totalPens", { n: totalPens ?? "—" })}
        </Text>
        <Text style={styles.previewLine}>
          {t("onboarding.step4.totalCapacity", { n: totalCapacity ?? "—" })}
        </Text>
        <Text style={styles.previewLine}>
          {t("onboarding.step4.occupancy", { pct: occupancyPct ?? "—" })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  title: { ...mobileTypography.title, fontSize: mobileFontSize.xl },
  sub: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginBottom: 8 },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  helper: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  layoutHint: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    marginTop: mobileSpacing.sm,
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 12,
    ...mobileTypography.body,
    backgroundColor: mobileColors.background
  },
  preview: {
    marginTop: mobileSpacing.lg,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    gap: 6
  },
  previewLine: { ...mobileTypography.body, fontWeight: "600" }
});
