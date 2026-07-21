import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  FinanceDonutChart,
  type FinanceDonutSlice
} from "../../finance/FinanceDonutChart";
import type { FarmDiseasesOverviewDto } from "../../../lib/api";
import { ScreenSection } from "../../layout/ScreenSection";
import { mobileColors, mobileSpacing, mobileTypography, mobileRadius } from "../../../theme/mobileTheme";
import { uiNamedColors } from "../../../theme/uiNamedColors";

const PIE_COLORS = [
  uiNamedColors.cFF6B6B,
  uiNamedColors.c4ECDC4,
  uiNamedColors.c45B7D1,
  uiNamedColors.c96CEB4,
  uiNamedColors.cFFEAA7,
  uiNamedColors.cDDA0DD
];

type Props = {
  overview: FarmDiseasesOverviewDto | undefined;
};

export function DiseasePieChart({ overview }: Props) {
  const { t } = useTranslation();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const slices: FinanceDonutSlice[] = useMemo(
    () =>
      (overview?.pieChart ?? []).map((row, i) => ({
        label: row.label,
        value: row.count,
        color: PIE_COLORS[i % PIE_COLORS.length]!
      })),
    [overview?.pieChart]
  );

  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const selected = slices.find((s) => s.label === selectedLabel);
  const selectedPct =
    selected && total > 0 ? Math.round((selected.value / total) * 100) : null;

  return (
    <ScreenSection title={t("health.diseases.pieTitle")}>
      <FinanceDonutChart
        slices={slices}
        useSliceColors
        centerMode="total"
        centerTitle={t("health.diseases.pieCenter")}
        selectedLabel={selectedLabel}
        onSlicePress={(label) =>
          setSelectedLabel((prev) => (prev === label ? null : label))
        }
        emptyLabel={t("health.diseases.pieEmpty")}
      />
      {selected && selectedPct != null ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{selected.label}</Text>
          <Text style={styles.tooltipMeta}>
            {t("health.diseases.pieTooltip", {
              count: selected.value,
              pct: selectedPct
            })}
          </Text>
        </View>
      ) : null}
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    alignItems: "center"
  },
  tooltipTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  tooltipMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  }
});
