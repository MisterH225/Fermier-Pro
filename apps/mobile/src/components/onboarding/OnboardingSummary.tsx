import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OnboardingFormState } from "../../hooks/useOnboarding";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  form: OnboardingFormState;
  breedersTotal: number;
  headcountTotal: number;
  totalPens: number | null;
  totalCapacity: number | null;
  occupancyPct: number | null;
};

export function OnboardingSummary({
  form,
  breedersTotal,
  headcountTotal,
  totalPens,
  totalCapacity,
  occupancyPct
}: Props) {
  const { t } = useTranslation();
  const rows = [
    { label: t("onboarding.summary.farm"), value: form.farmName },
    {
      label: t("onboarding.summary.location"),
      value: form.location?.label ?? "—"
    },
    {
      label: t("onboarding.summary.breeders"),
      value: String(breedersTotal)
    },
    {
      label: t("onboarding.summary.headcount"),
      value: String(headcountTotal)
    },
    {
      label: t("onboarding.summary.pens"),
      value: totalPens != null ? String(totalPens) : "—"
    },
    {
      label: t("onboarding.summary.capacity"),
      value: totalCapacity != null ? String(totalCapacity) : "—"
    },
    {
      label: t("onboarding.summary.occupancy"),
      value: occupancyPct != null ? `${occupancyPct} %` : "—"
    }
  ];
  return (
    <View style={styles.box}>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: 12,
    padding: mobileSpacing.md,
    gap: 8
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  label: { ...mobileTypography.meta, color: mobileColors.textSecondary, flex: 1 },
  value: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    flexShrink: 0
  }
});
