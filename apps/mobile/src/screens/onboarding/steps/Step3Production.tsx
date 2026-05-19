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

export function Step3Production({ ob }: Props) {
  const { t } = useTranslation();
  const { form, patch, headcountTotal } = ob;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("onboarding.step3.title")}</Text>
      <Text style={styles.sub}>{t("onboarding.step3.subtitle")}</Text>

      <Text style={styles.label}>{t("onboarding.step3.starter")} *</Text>
      <Text style={styles.helper}>{t("onboarding.step3.starterHelper")}</Text>
      <TextInput
        style={styles.input}
        value={form.starterHeadcount}
        onChangeText={(starterHeadcount) => patch({ starterHeadcount })}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t("onboarding.step3.fattening")} *</Text>
      <Text style={styles.helper}>{t("onboarding.step3.fatteningHelper")}</Text>
      <TextInput
        style={styles.input}
        value={form.fatteningHeadcount}
        onChangeText={(fatteningHeadcount) => patch({ fatteningHeadcount })}
        keyboardType="number-pad"
      />

      <View style={styles.preview}>
        <Text style={styles.previewText}>
          {t("onboarding.step3.preview", { total: headcountTotal })}
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
  helper: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
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
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md
  },
  previewText: { fontWeight: "700", color: mobileColors.accent }
});
