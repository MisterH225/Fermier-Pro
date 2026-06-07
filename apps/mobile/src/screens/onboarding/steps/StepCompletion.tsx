import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { OnboardingSummary } from "../../../components/onboarding/OnboardingSummary";
import type { useOnboarding } from "../../../hooks/useOnboarding";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = { ob: ReturnType<typeof useOnboarding> };

export function StepCompletion({ ob }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>{t("onboarding.completion.title")}</Text>
      <Text style={styles.sub}>{t("onboarding.completion.subtitle")}</Text>
      <OnboardingSummary
        form={ob.form}
        breedersTotal={ob.breedersTotal}
        headcountTotal={ob.headcountTotal}
        totalPens={ob.totalPens}
        totalCapacity={ob.totalCapacity}
        occupancyPct={ob.occupancyPct}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  emoji: { fontSize: 48, textAlign: "center" },
  title: {
    ...mobileTypography.title,
    fontSize: 24,
    textAlign: "center",
    color: mobileColors.success
  },
  sub: {
    ...mobileTypography.meta,
    textAlign: "center",
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  }
});
