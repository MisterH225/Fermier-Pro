import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { CheptelOverviewDto } from "../../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  overview: CheptelOverviewDto | undefined;
};

type CardDef = {
  key: string;
  icon: string;
  bg: string;
  accent: string;
  labelKey: string;
  unitKey?: string;
  value: (o: CheptelOverviewDto) => string;
  widget?: (o: CheptelOverviewDto) => React.ReactNode;
};

function miniDonut(
  slices: Array<{ value: number; color: string }>,
  accent: string
) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return null;
  }
  const size = 60;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 26;
  const rInner = 20;
  let angle = 0;
  const paths = slices.map((slice, i) => {
    const sweep = (slice.value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const sRad = ((start - 90) * Math.PI) / 180;
    const eRad = ((end - 90) * Math.PI) / 180;
    const xOs = cx + rOuter * Math.cos(sRad);
    const yOs = cy + rOuter * Math.sin(sRad);
    const xOe = cx + rOuter * Math.cos(eRad);
    const yOe = cy + rOuter * Math.sin(eRad);
    const xIe = cx + rInner * Math.cos(eRad);
    const yIe = cy + rInner * Math.sin(eRad);
    const xIs = cx + rInner * Math.cos(sRad);
    const yIs = cy + rInner * Math.sin(sRad);
    const large = sweep > 180 ? 1 : 0;
    const d = [
      `M ${xOs} ${yOs}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${xOe} ${yOe}`,
      `L ${xIe} ${yIe}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${xIs} ${yIs}`,
      "Z"
    ].join(" ");
    return <Path key={i} d={d} fill={slice.color || accent} />;
  });
  return (
    <Svg width={size} height={size}>
      {paths}
    </Svg>
  );
}

function miniBars(values: number[], color: string) {
  const max = Math.max(1, ...values);
  const h = 40;
  const w = 8;
  const gap = 4;
  return (
    <Svg width={values.length * (w + gap)} height={h}>
      {values.map((v, i) => {
        const barH = Math.max(4, (v / max) * h);
        return (
          <Rect
            key={i}
            x={i * (w + gap)}
            y={h - barH}
            width={w}
            height={barH}
            rx={2}
            fill={color}
          />
        );
      })}
    </Svg>
  );
}

export function CheptelKPICards({ overview }: Props) {
  const { t } = useTranslation();
  if (!overview) {
    return null;
  }

  const cards: CardDef[] = [
    {
      key: "total",
      icon: "🐷",
      bg: "#FFF3E0",
      accent: "#FF8C00",
      labelKey: "cheptel.totalHeadcount",
      unitKey: "health.diseases.unitSubjects",
      value: (o) => String(o.kpis.totalHeadcount ?? "—"),
      widget: (o) =>
        miniDonut(
          (o.miniWidgets?.categoryDonut ?? []).map((s, i) => ({
            value: s.count,
            color: ["#FF8C00", "#4ECDC4", "#45B7D1", "#96CEB4"][i % 4]!
          })),
          "#FF8C00"
        )
    },
    {
      key: "breeding",
      icon: "🐽",
      bg: "#FCE4EC",
      accent: "#E91E8C",
      labelKey: "cheptel.kpiBreedingFemales",
      unitKey: "cheptel.kpiUnitSows",
      value: (o) => String(o.kpis.breedingFemalesCount ?? "—"),
      widget: (o) =>
        miniDonut(
          (o.miniWidgets?.breedingDonut ?? []).map((s) => ({
            value: s.count,
            color: s.label === "gestating" ? "#E91E8C" : "#F8BBD0"
          })),
          "#E91E8C"
        )
    },
    {
      key: "fattening",
      icon: "📈",
      bg: "#E8F5E9",
      accent: "#2E7D32",
      labelKey: "cheptel.kpiFattening",
      unitKey: "health.diseases.unitSubjects",
      value: (o) => String(o.kpis.fatteningCount ?? "—"),
      widget: (o) => miniBars(o.miniWidgets?.fatteningTrend ?? [], "#2E7D32")
    },
    {
      key: "starter",
      icon: "🐣",
      bg: "#E3F2FD",
      accent: "#1565C0",
      labelKey: "cheptel.kpiStarter",
      unitKey: "health.diseases.unitSubjects",
      value: (o) => String(o.kpis.starterCount ?? "—"),
      widget: (o) => miniBars(o.miniWidgets?.starterTrend ?? [], "#1565C0")
    },
    {
      key: "nursing",
      icon: "🍼",
      bg: "#FCE4EC",
      accent: "#EC407A",
      labelKey: "cheptel.kpiNursing",
      unitKey: "health.diseases.unitSubjects",
      value: (o) => String(o.kpis.nursingCount ?? "—")
    },
    {
      key: "occupancy",
      icon: "🏠",
      bg: "#EDE7F6",
      accent: "#6A1B9A",
      labelKey: "cheptel.occupancy",
      value: (o) =>
        o.kpis.occupancyRate != null ? `${o.kpis.occupancyRate}%` : "—",
      widget: (o) =>
        miniDonut(
          (o.miniWidgets?.occupancyDonut ?? []).map((s) => ({
            value: s.count,
            color: s.label === "occupied" ? "#6A1B9A" : "#D1C4E9"
          })),
          "#6A1B9A"
        )
    },
    {
      key: "sick",
      icon: "🤒",
      bg: "#FFF8E1",
      accent: "#F57F17",
      labelKey: "cheptel.kpiSick",
      unitKey: "health.diseases.unitSubjects",
      value: (o) => String(o.kpis.sickAnimalsCount ?? 0),
      widget: (o) => {
        const n = o.kpis.sickAnimalsCount ?? 0;
        if (n <= 0) {
          return null;
        }
        return (
          <View style={[styles.alertBadge, { borderColor: "#F57F17" }]}>
            <Text style={[styles.alertText, { color: "#F57F17" }]}>!</Text>
          </View>
        );
      }
    }
  ];

  return (
    <View style={styles.grid}>
      {cards.map((card) => (
        <View key={card.key} style={[styles.card, { backgroundColor: card.bg }]}>
          <View style={styles.topRow}>
            <Text style={styles.icon}>{card.icon}</Text>
            <Text style={styles.label}>{t(card.labelKey)}</Text>
          </View>
          <View style={styles.bottomRow}>
            <View style={styles.valueCol}>
              <Text style={[styles.value, { color: card.accent }]}>
                {card.value(overview)}
              </Text>
              {card.unitKey ? (
                <Text style={styles.unit}>{t(card.unitKey)}</Text>
              ) : null}
            </View>
            <View style={styles.widgetCol}>{card.widget?.(overview)}</View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  card: {
    width: "47%",
    flexGrow: 1,
    minWidth: "46%",
    borderRadius: 20,
    padding: mobileSpacing.md,
    minHeight: 120,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  icon: { fontSize: 18 },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    flex: 1
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  valueCol: { flex: 1 },
  value: { fontSize: 24, fontWeight: "800" },
  unit: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  widgetCol: { alignItems: "flex-end", justifyContent: "flex-end" },
  alertBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  alertText: { fontWeight: "800", fontSize: 16 }
});
