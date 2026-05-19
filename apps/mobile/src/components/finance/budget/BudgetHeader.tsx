import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { budgetMonthLabel, globalStatusKey } from "./budgetUtils";

type Props = {
  year: number;
  month: number;
  locale: string;
  globalStatus: "on_track" | "warning" | "exceeded";
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onConfigure: () => void;
};

export function BudgetHeader({
  year,
  month,
  locale,
  globalStatus,
  onPrevMonth,
  onNextMonth,
  onConfigure
}: Props) {
  const { t } = useTranslation();
  const statusKey = globalStatusKey(globalStatus);
  const badge = t(`budgetScreen.status.${statusKey}`);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onPrevMonth}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={t("budgetScreen.prevMonth")}
        >
          <Ionicons name="chevron-back" size={22} color={mobileColors.textPrimary} />
        </Pressable>
        <Text style={styles.month}>{budgetMonthLabel(year, month, locale)}</Text>
        <Pressable
          onPress={onNextMonth}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={t("budgetScreen.nextMonth")}
        >
          <Ionicons name="chevron-forward" size={22} color={mobileColors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={onConfigure}
          style={styles.gearBtn}
          accessibilityRole="button"
          accessibilityLabel={t("budgetScreen.configure")}
        >
          <Ionicons name="settings-outline" size={22} color={mobileColors.accent} />
        </Pressable>
      </View>
      <View style={[styles.badge, styles[`badge_${statusKey}`]]}>
        <Text style={styles.badgeTx}>{badge}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  navBtn: {
    padding: mobileSpacing.xs,
    borderRadius: mobileRadius.sm
  },
  month: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    flex: 1,
    textAlign: "center",
    textTransform: "capitalize"
  },
  gearBtn: {
    padding: mobileSpacing.xs,
    marginLeft: mobileSpacing.xs
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.pill
  },
  badge_onTrack: { backgroundColor: "rgba(45,106,79,0.12)" },
  badge_warning: { backgroundColor: "rgba(230,126,34,0.15)" },
  badge_exceeded: { backgroundColor: "rgba(192,57,43,0.12)" },
  badgeTx: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  }
});
