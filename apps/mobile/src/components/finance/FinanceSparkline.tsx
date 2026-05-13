import { useMemo } from "react";
import Svg, { Line, Polyline } from "react-native-svg";
import { mobileColors } from "../../theme/mobileTheme";

const PAD_X = 4;
const PAD_Y = 2;
const BOTTOM = 2;

type Props = {
  values: number[];
  width: number;
  height: number;
  strokeColor: string;
  /** Ligne de base (axe) */
  showAxis?: boolean;
};

/**
 * Courbe simple type « sparkline » (une série).
 */
export function FinanceSparkline({
  values,
  width,
  height,
  strokeColor,
  showAxis = true
}: Props) {
  const plotW = Math.max(1, width - PAD_X * 2);
  const plotH = Math.max(1, height - PAD_Y * 2 - BOTTOM);

  const points = useMemo(() => {
    const n = values.length;
    if (n === 0) {
      return "";
    }
    const maxY = Math.max(1, ...values.map((v) => Math.abs(v)), 1e-6);
    const minY = Math.min(0, ...values);
    const span = Math.max(maxY - minY, 1e-6);
    const xAt = (i: number) => {
      if (n <= 1) {
        return PAD_X + plotW / 2;
      }
      return PAD_X + (plotW * i) / (n - 1);
    };
    const yAt = (v: number) => PAD_Y + plotH * (1 - (v - minY) / span);
    return values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  }, [values, plotH, plotW]);

  if (!values.length) {
    return null;
  }

  const axisY = PAD_Y + plotH;

  if (width < 12 || height < 12) {
    return null;
  }

  return (
    <Svg width={width} height={height}>
      {showAxis ? (
        <Line
          x1={PAD_X}
          y1={axisY}
          x2={width - PAD_X}
          y2={axisY}
          stroke={mobileColors.border}
          strokeWidth={1}
        />
      ) : null}
      <Polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
