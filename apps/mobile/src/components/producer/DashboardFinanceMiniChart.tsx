import { useMemo } from "react";
import Svg, { Line, Polyline } from "react-native-svg";
import type { DashboardFinanceMonthPoint } from "../../lib/api";
import { mobileColors } from "../../theme/mobileTheme";

const PAD = 6;
const BOTTOM = 14;

type Props = {
  months: DashboardFinanceMonthPoint[];
  width: number;
  height: number;
};

/**
 * Deux courbes (dépenses / revenus) sur les points mensuels renvoyés par l’API.
 */
export function DashboardFinanceMiniChart({ months, width, height }: Props) {
  const plotW = Math.max(1, width - PAD * 2);
  const plotH = Math.max(1, height - PAD * 2 - BOTTOM);

  const { expPts, revPts } = useMemo(() => {
    const exp = months.map((m) => Number(m.expenses));
    const rev = months.map((m) => Number(m.revenues));
    const maxY = Math.max(1, ...exp, ...rev);
    const n = months.length;
    const xAt = (i: number) => {
      if (n <= 1) {
        return PAD + plotW / 2;
      }
      return PAD + (plotW * i) / (n - 1);
    };
    const yAt = (v: number) => PAD + plotH * (1 - v / maxY);
    const expPtsStr = months.map((_, i) => `${xAt(i)},${yAt(exp[i])}`).join(" ");
    const revPtsStr = months.map((_, i) => `${xAt(i)},${yAt(rev[i])}`).join(" ");
    return { expPts: expPtsStr, revPts: revPtsStr };
  }, [months, plotH, plotW]);

  const axisY = PAD + plotH;

  if (width < 16 || height < 16) {
    return null;
  }

  return (
    <Svg width={width} height={height}>
      <Line
        x1={PAD}
        y1={axisY}
        x2={width - PAD}
        y2={axisY}
        stroke={mobileColors.border}
        strokeWidth={1}
      />
      <Polyline
        points={expPts}
        fill="none"
        stroke={mobileColors.error}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Polyline
        points={revPts}
        fill="none"
        stroke={mobileColors.success}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
