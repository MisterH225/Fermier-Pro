import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { useOnboarding } from "../../../hooks/useOnboarding";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = { ob: ReturnType<typeof useOnboarding> };

export function Step2Breeders({ ob }: Props) {
  const { t } = useTranslation();
  const { form, patch, breedersTotal, showBreederWarning } = ob;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("onboarding.step2.title")}</Text>
      <Text style={styles.sub}>{t("onboarding.step2.subtitle")}</Text>

      <Text style={styles.label}>{t("onboarding.step2.females")} *</Text>
      <TextInput
        style={styles.input}
        value={form.femaleBreeders}
        onChangeText={(femaleBreeders) => patch({ femaleBreeders })}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t("onboarding.step2.males")} *</Text>
      <TextInput
        style={styles.input}
        value={form.maleBreeders}
        onChangeText={(maleBreeders) => patch({ maleBreeders })}
        keyboardType="number-pad"
      />

      {showBreederWarning ? (
        <Text style={styles.warn}>{t("onboarding.step2.zeroWarning")}</Text>
      ) : null}

      <View style={styles.preview}>
        <Text style={styles.previewText}>
          {t("onboarding.step2.preview", { total: breedersTotal })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  title: { ...mobileTypography.title, fontSize: 22 },
  sub: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginBottom: 8 },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
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
  warn: { color: "#C2410C", ...mobileTypography.meta, fontWeight: "600" },
  preview: {
    marginTop: mobileSpacing.lg,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md
  },
  previewText: { fontWeight: "700", color: mobileColors.accent }
});
