import { StyleSheet, Text, View } from "react-native";
import { SmartChart } from "../charts";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

/** Palettes pastel (réf. dashboard bien-être : orange, bleu, jaune, vert). */
export type FinanceKpiPastelVariant = "orange" | "blue" | "yellow" | "green";

/** Alias historiques — mappés vers les pastels ci-dessus. */
export type FinanceKpiVariant =
  | FinanceKpiPastelVariant
  | "dark"
  | "income"
  | "expense"
  | "margin";

const PASTEL: Record<
  FinanceKpiPastelVariant,
  { bg: string; accent: string; title: string; value: string }
> = {
  orange: {
    bg: "#FFF4EB",
    accent: "#F97316",
    title: mobileColors.textSecondary,
    value: mobileColors.textPrimary
  },
  blue: {
    bg: "#EFF6FF",
    accent: "#3B82F6",
    title: mobileColors.textSecondary,
    value: mobileColors.textPrimary
  },
  yellow: {
    bg: "#FFFBEB",
    accent: "#EAB308",
    title: mobileColors.textSecondary,
    value: mobileColors.textPrimary
  },
  green: {
    bg: "#ECFDF5",
    accent: "#22C55E",
    title: mobileColors.textSecondary,
    value: mobileColors.textPrimary
  }
};

function resolvePastelVariant(variant: FinanceKpiVariant): FinanceKpiPastelVariant {
  switch (variant) {
    case "dark":
      return "orange";
    case "income":
      return "blue";
    case "expense":
      return "yellow";
    case "margin":
      return "green";
    default:
      return variant;
  }
}

const CARD_MIN_HEIGHT = 156;
const DELTA_SLOT_HEIGHT = 18;
const SPARK_SLOT_HEIGHT = 44;

function valueFontSize(value: string): number {
  const len = value.trim().length;
  if (len > 16) return 13;
  if (len > 12) return 15;
  return 17;
}

type Props = {
  title: string;
  value: string;
  deltaText?: string | null;
  sparklineValues?: number[];
  sparklineColor?: string;
  variant: FinanceKpiVariant;
};

export function FinanceKpiCard({
  title,
  value,
  deltaText,
  sparklineValues,
  sparklineColor,
  variant
}: Props) {
  const pastel = resolvePastelVariant(variant);
  const theme = PASTEL[pastel];
  const sparkH = 40;
  const lineCol = sparklineColor ?? theme.accent;
  const showSpark = Boolean(sparklineValues && sparklineValues.length > 1);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.bg, minHeight: CARD_MIN_HEIGHT }
      ]}
    >
      <Text
        style={[styles.title, { color: theme.title }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
      <View style={styles.valueWrap}>
        <Text
          style={[
            styles.value,
            {
              color: theme.value,
              fontSize: valueFontSize(value)
            }
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
      <View style={styles.deltaSlot}>
        {deltaText ? (
          <Text
            style={[styles.delta, { color: theme.title }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {deltaText}
          </Text>
        ) : null}
      </View>
      <View style={styles.sparkSlot}>
        {showSpark ? (
          <SmartChart
            compact
            height={sparkH}
            lines={[
              {
                key: "spark",
                label: "",
                color: lineCol,
                data: sparklineValues!.map((v, i) => ({
                  month: String(i),
                  value: v
                }))
              }
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: "stretch",
    minWidth: 0,
    maxWidth: "100%",
    width: "100%",
    flexShrink: 1,
    overflow: "hidden",
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent"
  },
  title: {
    ...mobileTypography.meta,
    fontWeight: "600",
    flexShrink: 1
  },
  valueWrap: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    marginTop: mobileSpacing.sm
  },
  value: {
    fontWeight: "800",
    letterSpacing: -0.3,
    flexShrink: 1
  },
  deltaSlot: {
    minHeight: DELTA_SLOT_HEIGHT,
    marginTop: mobileSpacing.xs,
    justifyContent: "center"
  },
  delta: {
    ...mobileTypography.meta,
    fontWeight: "600"
  },
  sparkSlot: {
    minHeight: SPARK_SLOT_HEIGHT,
    marginTop: mobileSpacing.sm,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    width: "100%",
    overflow: "hidden"
  }
});
