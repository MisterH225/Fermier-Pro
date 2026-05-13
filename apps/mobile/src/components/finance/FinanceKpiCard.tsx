import { StyleSheet, Text, View } from "react-native";
import { FinanceSparkline } from "./FinanceSparkline";
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

type Props = {
  title: string;
  value: string;
  deltaText?: string | null;
  sparklineValues?: number[];
  sparklineColor?: string;
  variant: Variant;
  onLayoutWidth?: number;
};

export function FinanceKpiCard({
  title,
  value,
  deltaText,
  sparklineValues,
  sparklineColor,
  variant,
  onLayoutWidth = 158
}: Props) {
  const sparkW = Math.max(60, onLayoutWidth - mobileSpacing.md * 2);
  const sparkH = 40;
  const lineCol =
    sparklineColor ??
    (variant === "dark" ? mobileColors.accentSoft : mobileColors.accent);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: variantBg[variant] },
        variant === "dark" ? styles.cardDark : styles.cardLight
      ]}
    >
      <Text style={[styles.title, { color: variantTitle[variant] }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.value, { color: variantValue[variant] }]} numberOfLines={2}>
        {value}
      </Text>
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
        >
          {deltaText}
        </Text>
      ) : null}
      {sparklineValues && sparklineValues.length > 1 ? (
        <View style={styles.sparkWrap}>
          <FinanceSparkline
            values={sparklineValues}
            width={sparkW}
            height={sparkH}
            strokeColor={lineCol}
            showAxis={variant !== "dark"}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
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
    fontWeight: "600",
    flex: 1
  },
  value: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: mobileSpacing.sm,
    letterSpacing: -0.3
  },
  delta: {
    ...mobileTypography.meta,
    marginTop: mobileSpacing.xs,
    fontWeight: "600"
  },
  sparkWrap: { marginTop: mobileSpacing.sm, alignItems: "flex-start" }
});
