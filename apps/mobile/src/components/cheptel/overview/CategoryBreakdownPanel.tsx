import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  FinanceDonutChart,
  type FinanceDonutSlice
} from "../../finance/FinanceDonutChart";
import { cheptelCategoryColor } from "./cheptelCategoryColors";
import type { CheptelCategoryBreakdownRow } from "../../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  rows: CheptelCategoryBreakdownRow[];
};

export function CategoryBreakdownPanel({ rows }: Props) {
  const { t } = useTranslation();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const slices: FinanceDonutSlice[] = useMemo(
    () =>
      rows.map((row, i) => ({
        label: t(`cheptel.category.${row.key}`, { defaultValue: row.key }),
        value: row.count,
        color: cheptelCategoryColor(row.key, i)
      })),
    [rows, t]
  );

  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const selected = slices.find((s) => s.label === selectedLabel);
  const selectedPct =
    selected && total > 0 ? Math.round((selected.value / total) * 100) : null;

  return (
    <View style={styles.wrap}>
      <FinanceDonutChart
        slices={slices}
        useSliceColors
        centerMode="total"
        centerTitle={t("cheptel.categoryPieCenter")}
        selectedLabel={selectedLabel}
        onSlicePress={(label) =>
          setSelectedLabel((prev) => (prev === label ? null : label))
        }
        emptyLabel="—"
      />
      {selected && selectedPct != null ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{selected.label}</Text>
          <Text style={styles.tooltipMeta}>
            {t("cheptel.categoryPieTooltip", {
              count: selected.value,
              pct: selectedPct
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  tooltip: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: 12,
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
