import { StyleSheet, Text, View } from "react-native";
import { SmartChart } from "../charts";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Variant = "dark" | "income" | "expense" | "margin";

const variantBg: Record<Variant, string> = {
  dark: mobileColors.textPrimary,
  income: mobileColors.accentSoft,
  expense: mobileColors.surface,
  margin: mobileColors.surfaceMuted
};

const variantTitle: Record<Variant, string> = {
  dark: "rgba(255,255,255,0.72)",
  income: mobileColors.textSecondary,
  expense: mobileColors.textSecondary,
  margin: mobileColors.textSecondary
};

const variantValue: Record<Variant, string> = {
  dark: "#FFFFFF",
  income: mobileColors.textPrimary,
  expense: mobileColors.textPrimary,
  margin: mobileColors.textPrimary
};

const CARD_MIN_HEIGHT = 156;
const DELTA_SLOT_HEIGHT = 18;
const SPARK_SLOT_HEIGHT = 44;

type Props = {
  title: string;
  value: string;
  deltaText?: string | null;
  sparklineValues?: number[];
  sparklineColor?: string;
  variant: Variant;
};

export function FinanceKpiCard({
  title,
  value,
  deltaText,
  sparklineValues,
  sparklineColor,
  variant
}: Props) {
  const sparkH = 40;
  const lineCol =
    sparklineColor ??
    (variant === "dark" ? mobileColors.accentSoft : mobileColors.accent);

  const showSpark = Boolean(sparklineValues && sparklineValues.length > 1);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: variantBg[variant], minHeight: CARD_MIN_HEIGHT },
        variant === "dark" ? styles.cardDark : styles.cardLight
      ]}
    >
      <Text style={[styles.title, { color: variantTitle[variant] }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.value, { color: variantValue[variant] }]} numberOfLines={2}>
        {value}
      </Text>
      <View style={styles.deltaSlot}>
        {deltaText ? (
          <Text
            style={[
              styles.delta,
              {
                color:
                  variant === "dark"
                    ? "rgba(255,255,255,0.85)"
                    : mobileColors.textSecondary
              }
            ]}
            numberOfLines={1}
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
                data: sparklineValues!.map((value, i) => ({
                  month: String(i),
                  value
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
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  cardLight: {
    ...mobileShadows.card
  },
  cardDark: {
    borderColor: "rgba(255,255,255,0.12)"
  },
  title: {
    ...mobileTypography.meta,
    fontWeight: "600"
  },
  value: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: mobileSpacing.sm,
    letterSpacing: -0.3
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
    alignItems: "flex-start"
  }
});
