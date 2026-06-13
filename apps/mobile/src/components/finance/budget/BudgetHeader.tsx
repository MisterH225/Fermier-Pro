import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppDatePicker } from "../../common/AppDatePicker";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { globalStatusKey } from "./budgetUtils";

type Props = {
  year: number;
  month: number;
  farmId?: string;
  globalStatus: "on_track" | "warning" | "exceeded";
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthSelect: (year: number, month: number) => void;
  onConfigure: () => void;
};

export function BudgetHeader({
  year,
  month,
  farmId,
  globalStatus,
  onPrevMonth,
  onNextMonth,
  onMonthSelect,
  onConfigure
}: Props) {
  const { t } = useTranslation();
  const statusKey = globalStatusKey(globalStatus);
  const badge = t(`budgetScreen.status.${statusKey}`);
  const monthIso = `${year}-${String(month).padStart(2, "0")}`;

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
        <View style={styles.monthPicker}>
          <AppDatePicker
            mode="month_year"
            farmId={farmId}
            isoValue={monthIso}
            onIsoChange={(iso) => {
              const m = /^(\d{4})-(\d{2})/.exec(iso.trim());
              if (!m) {
                return;
              }
              onMonthSelect(Number(m[1]), Number(m[2]));
            }}
          />
        </View>
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
  monthPicker: { flex: 1 },
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
  badgeTx: { ...mobileTypography.meta, fontWeight: "700" }
});
