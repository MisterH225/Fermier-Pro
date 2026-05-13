import { Text, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type FinanceBarDatum = {
  label: string;
  value: number;
  color?: string;
};

type Props = {
  data: FinanceBarDatum[];
  barMaxHeight?: number;
  emptyLabel?: string;
};

/**
 * Histogramme simple (colonnes), sans lib externe.
 */
export function FinanceBarChart({
  data,
  barMaxHeight = 112,
  emptyLabel = "—"
}: Props) {
  const max = Math.max(1, ...data.map((d) => d.value), 1e-9);

  if (!data.length) {
    return (
      <Text style={{ ...mobileTypography.meta, color: mobileColors.textSecondary }}>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", minHeight: barMaxHeight + 22 }}>
      {data.map((d, i) => {
        const h = Math.max(6, (d.value / max) * barMaxHeight);
        return (
          <View
            key={`${d.label}-${i}`}
            style={{
              flex: 1,
              alignItems: "center",
              marginHorizontal: mobileSpacing.xs
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 36,
                height: barMaxHeight,
                justifyContent: "flex-end",
                alignItems: "center"
              }}
            >
              <View
                style={{
                  width: "85%",
                  height: h,
                  borderRadius: mobileRadius.sm,
                  backgroundColor: d.color ?? mobileColors.accent
                }}
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                ...mobileTypography.meta,
                color: mobileColors.textSecondary,
                marginTop: mobileSpacing.xs,
                textAlign: "center",
                fontSize: 10
              }}
            >
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
