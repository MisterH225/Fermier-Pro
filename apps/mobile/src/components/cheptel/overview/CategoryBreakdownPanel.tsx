import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { CheptelCategoryBreakdownRow } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

const PALETTE = [
  mobileColors.accent,
  mobileColors.success,
  mobileColors.warning,
  "#5B8DEF",
  mobileColors.textSecondary
];

type Props = {
  rows: CheptelCategoryBreakdownRow[];
};

export function CategoryBreakdownPanel({ rows }: Props) {
  const { t } = useTranslation();
  const total = rows.reduce((s, r) => s + r.count, 0);

  if (!rows.length || total <= 0) {
    return <Text style={styles.empty}>—</Text>;
  }

  return (
    <View style={styles.wrap}>
      {rows.map((row, i) => {
        const pct = Math.round((row.count / total) * 100);
        const color = PALETTE[i % PALETTE.length]!;
        const label = t(`cheptel.category.${row.key}`, {
          defaultValue: row.key
        });
        return (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowHead}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.lab} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.val}>
                {row.count} ({pct}%)
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: color }
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  row: { gap: mobileSpacing.xs },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  lab: {
    flex: 1,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  val: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "700"
  },
  track: {
    height: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    borderRadius: mobileRadius.pill
  }
});
