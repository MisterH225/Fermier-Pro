import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FarmReportPeriodType } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

export type ReportAnchorState = {
  year: number;
  month: number;
  quarter: number;
};

type Props = {
  periodType: FarmReportPeriodType;
  onPeriodTypeChange: (p: FarmReportPeriodType) => void;
  anchor: ReportAnchorState;
  onAnchorChange: (a: ReportAnchorState) => void;
};

function Chip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? mobileColors.accent : mobileColors.surface,
          borderColor: active ? mobileColors.accent : mobileColors.border
        }
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? "#FFFFFF" : mobileColors.textPrimary }
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function periodLabel(
  t: (k: string, o?: Record<string, string | number>) => string,
  periodType: FarmReportPeriodType,
  anchor: ReportAnchorState
): string {
  if (periodType === "monthly") {
    return `${String(anchor.month).padStart(2, "0")}/${anchor.year}`;
  }
  if (periodType === "quarterly") {
    return t("reportsScreen.quarterLabel", { q: anchor.quarter, y: anchor.year });
  }
  return String(anchor.year);
}

export function PeriodSelector({
  periodType,
  onPeriodTypeChange,
  anchor,
  onAnchorChange
}: Props) {
  const { t, i18n } = useTranslation();
  const label = periodLabel(t, periodType, anchor);
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const prev = () => {
    if (periodType === "monthly") {
      const d = new Date(Date.UTC(anchor.year, anchor.month - 2, 1));
      onAnchorChange({
        ...anchor,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1
      });
    } else if (periodType === "quarterly") {
      const q = anchor.quarter <= 1 ? 4 : anchor.quarter - 1;
      const y = anchor.quarter <= 1 ? anchor.year - 1 : anchor.year;
      onAnchorChange({ ...anchor, quarter: q, year: y });
    } else {
      onAnchorChange({ ...anchor, year: anchor.year - 1 });
    }
  };

  const next = () => {
    if (periodType === "monthly") {
      const d = new Date(Date.UTC(anchor.year, anchor.month, 1));
      onAnchorChange({
        ...anchor,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1
      });
    } else if (periodType === "quarterly") {
      const q = anchor.quarter >= 4 ? 1 : anchor.quarter + 1;
      const y = anchor.quarter >= 4 ? anchor.year + 1 : anchor.year;
      onAnchorChange({ ...anchor, quarter: q, year: y });
    } else {
      onAnchorChange({ ...anchor, year: anchor.year + 1 });
    }
  };

  const longLabel =
    periodType === "monthly"
      ? new Date(
          Date.UTC(anchor.year, anchor.month - 1, 1)
        ).toLocaleDateString(locale, { month: "long", year: "numeric" })
      : label;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("reportsScreen.periodTitle")}</Text>
      <View style={styles.row}>
        <Chip
          label={t("reportsScreen.periodMonthly")}
          active={periodType === "monthly"}
          onPress={() => onPeriodTypeChange("monthly")}
        />
        <Chip
          label={t("reportsScreen.periodQuarterly")}
          active={periodType === "quarterly"}
          onPress={() => onPeriodTypeChange("quarterly")}
        />
        <Chip
          label={t("reportsScreen.periodYearly")}
          active={periodType === "yearly"}
          onPress={() => onPeriodTypeChange("yearly")}
        />
      </View>
      <View style={styles.navRow}>
        <Pressable onPress={prev} style={styles.navBtn} accessibilityRole="button">
          <Text style={styles.navBtnText}>◀</Text>
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navMain}>{label}</Text>
          {periodType === "monthly" ? (
            <Text style={styles.navSub}>{longLabel}</Text>
          ) : null}
        </View>
        <Pressable onPress={next} style={styles.navBtn} accessibilityRole="button">
          <Text style={styles.navBtnText}>▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: mobileSpacing.sm },
  title: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  row: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth
  },
  chipLabel: { ...mobileTypography.meta, fontWeight: "700" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: mobileSpacing.xs,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  navBtn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  navBtnText: { fontSize: 18, color: mobileColors.accent, fontWeight: "800" },
  navCenter: { flex: 1, alignItems: "center" },
  navMain: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  navSub: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
