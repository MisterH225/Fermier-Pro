import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  step: number;
  total?: number;
};

export function StepProgressBar({ step, total = 4 }: Props) {
  const { t } = useTranslation();
  const pct = Math.min(100, ((step + 1) / total) * 100);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {t("onboarding.progress", { current: step + 1, total })}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: mobileSpacing.lg },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 6
  },
  track: {
    height: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.border,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill
  }
});
