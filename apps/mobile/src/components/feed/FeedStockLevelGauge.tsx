import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  name: string;
  subtitle: string;
  /** Valeur principale (ex. « 42 % restant »). */
  displayValue: string;
  /** Remplissage jauge 0–100 ; null = piste vide. */
  percent: number | null;
  /** Couleur de la jauge selon criticité stock. */
  gaugeColor: string;
  /** Estimation jours — toujours en gris (informatif). */
  daysLabel?: string;
  dotColor: string;
  /** Dernier contrôle > 7 jours — sous-titre en orange. */
  lastCheckWarning?: boolean;
  /** `embedded` = ligne dans une carte parente (dashboard). */
  variant?: "card" | "embedded";
};

const GAUGE_W = 112;
const GAUGE_H = 68;
const CX = GAUGE_W / 2;
/** Centre en bas de la jauge : arc visible = demi-cercle supérieur (gauche → haut → droite). */
const CY = GAUGE_H - 6;
const R = 44;
const STROKE = 10;
/** Extrémité gauche de l’arc (sens horaire vers la droite en passant par le haut). */
const ARC_START = 270;
const ARC_END = 90;

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  clockwise = true
): string {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));

  let sweepDeg = endDeg - startDeg;
  if (clockwise) {
    if (sweepDeg <= 0) {
      sweepDeg += 360;
    }
  } else if (sweepDeg >= 0) {
    sweepDeg -= 360;
  }
  const large = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweepFlag = clockwise ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweepFlag} ${x2} ${y2}`;
}

function SemiGauge({
  percent,
  color
}: {
  percent: number | null;
  color: string;
}) {
  const fillEnd =
    percent == null
      ? ARC_START
      : ARC_START + (Math.min(100, Math.max(0, percent)) / 100) * 180;

  return (
    <View style={styles.gaugeWrap}>
      <Svg width={GAUGE_W} height={GAUGE_H}>
        <Path
          d={arcPath(CX, CY, R, ARC_START, ARC_END, true)}
          stroke={mobileColors.border}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
        />
        {percent != null && percent > 0 ? (
          <Path
            d={arcPath(CX, CY, R, ARC_START, fillEnd, true)}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

export function FeedStockLevelGauge({
  name,
  subtitle,
  displayValue,
  percent,
  gaugeColor,
  daysLabel,
  dotColor,
  lastCheckWarning,
  variant = "card"
}: Props) {
  return (
    <View
      style={[
        styles.card,
        variant === "embedded" && styles.cardEmbedded
      ]}
    >
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text
          style={[styles.subtitle, lastCheckWarning && styles.subtitleWarn]}
          numberOfLines={3}
        >
          {subtitle}
        </Text>
        <Text style={styles.displayValue}>{displayValue}</Text>
        {daysLabel ? (
          <Text style={styles.daysEstimate}>{daysLabel}</Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <SemiGauge percent={percent} color={gaugeColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  cardEmbedded: {
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 0,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: "transparent"
  },
  left: {
    flex: 1,
    paddingRight: mobileSpacing.sm
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  name: {
    flex: 1,
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  subtitleWarn: {
    color: mobileColors.warning
  },
  daysEstimate: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  displayValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  right: {
    width: GAUGE_W,
    alignItems: "center",
    justifyContent: "center"
  },
  gaugeWrap: {
    width: GAUGE_W,
    height: GAUGE_H
  }
});
