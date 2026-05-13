import type { ReactElement } from "react";
import { Text, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type FinanceDonutSegment = {
  label: string;
  value: number;
  /** Affichage du montant (ex. devise formatée). */
  display?: string;
  color: string;
};

function slicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + rOuter * Math.cos(rad(startAngle));
  const y1 = cy + rOuter * Math.sin(rad(startAngle));
  const x2 = cx + rOuter * Math.cos(rad(endAngle));
  const y2 = cy + rOuter * Math.sin(rad(endAngle));
  const x3 = cx + rInner * Math.cos(rad(endAngle));
  const y3 = cy + rInner * Math.sin(rad(endAngle));
  const x4 = cx + rInner * Math.cos(rad(startAngle));
  const y4 = cy + rInner * Math.sin(rad(startAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z"
  ].join(" ");
}

type Props = {
  segments: FinanceDonutSegment[];
  size?: number;
  innerRatio?: number;
  centerTitle?: string;
  centerValue?: string;
  emptyLabel?: string;
};

/**
 * Anneau + légende (style « insights »).
 */
export function FinanceDonutChart({
  segments,
  size = 132,
  innerRatio = 0.58,
  centerTitle,
  centerValue,
  emptyLabel = "—"
}: Props) {
  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((a, s) => a + s.value, 0);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 6;
  const rInner = rOuter * innerRatio;

  let angle = 0;
  const paths: ReactElement[] = [];
  if (total > 0) {
    for (const seg of positive) {
      const sweep = (seg.value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      paths.push(
        <Path
          key={`${seg.label}-${start}-${end}`}
          d={slicePath(cx, cy, rOuter, rInner, start, end)}
          fill={seg.color}
        />
      );
    }
  }

  const showEmpty = total <= 0;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: mobileSpacing.md }}>
      <View style={{ width: size, height: size, position: "relative" }}>
        {showEmpty ? (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 10,
              borderColor: mobileColors.border,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text
              style={{
                ...mobileTypography.meta,
                color: mobileColors.textSecondary,
                textAlign: "center",
                paddingHorizontal: 8
              }}
            >
              {emptyLabel}
            </Text>
          </View>
        ) : (
          <>
            <Svg width={size} height={size}>
              <G>{paths}</G>
            </Svg>
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none"
              }}
            >
              {centerTitle ? (
                <Text
                  style={{
                    ...mobileTypography.meta,
                    color: mobileColors.textSecondary,
                    fontSize: 10,
                    textAlign: "center"
                  }}
                >
                  {centerTitle}
                </Text>
              ) : null}
              {centerValue ? (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: mobileColors.textPrimary,
                    textAlign: "center",
                    maxWidth: rInner * 2.2
                  }}
                  numberOfLines={2}
                >
                  {centerValue}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
      <View style={{ flex: 1, gap: mobileSpacing.sm }}>
        {positive.slice(0, 8).map((s) => (
          <View
            key={s.label}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: s.color
              }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ ...mobileTypography.meta, color: mobileColors.textPrimary }}
              >
                {s.label}
              </Text>
            </View>
            <Text style={{ ...mobileTypography.meta, fontWeight: "600" }}>
              {s.display ??
                s.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
