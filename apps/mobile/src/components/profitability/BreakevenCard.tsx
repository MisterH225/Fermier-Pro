import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { FarmProfitabilityDto } from "../../lib/api";
import { coerceFiniteNumber, roundCoerced } from "../../lib/coerceNumber";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  data: FarmProfitabilityDto;
  currencySymbol: string;
  viewMode: "realized" | "projected" | "combined";
};

export function BreakevenCard({ data, currencySymbol, viewMode }: Props) {
  const { t } = useTranslation();
  const metrics =
    viewMode === "projected"
      ? data.projected
      : viewMode === "combined"
        ? data.combined
        : data.realized;

  const breakeven = coerceFiniteNumber(metrics.breakevenPricePerKg);
  const market = coerceFiniteNumber(data.marketPricePerKg);
  if (breakeven == null && market == null) {
    return null;
  }

  const marginAbove =
    market != null && breakeven != null ? market - breakeven : null;
  const progress =
    market != null && breakeven != null && breakeven > 0
      ? Math.min(1.2, market / breakeven)
      : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("profitability.breakevenTitle")}</Text>
      {breakeven != null ? (
        <Text style={styles.body}>
          {t("profitability.breakevenExplain", {
            price: roundCoerced(breakeven) ?? 0,
            currency: currencySymbol
          })}
        </Text>
      ) : null}
      {market != null ? (
        <Text style={styles.body}>
          {t("profitability.currentMarket", {
            price: roundCoerced(market) ?? 0,
            currency: currencySymbol
          })}
        </Text>
      ) : null}
      {marginAbove != null ? (
        <Text
          style={[
            styles.marginAbove,
            { color: marginAbove >= 0 ? mobileColors.success : mobileColors.error }
          ]}
        >
          {t("profitability.safetyMargin", {
            delta: roundCoerced(Math.abs(marginAbove)) ?? 0,
            currency: currencySymbol,
            direction: marginAbove >= 0 ? "+" : "−"
          })}
        </Text>
      ) : null}
      {progress != null ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(100, progress * 100)}%`,
                backgroundColor:
                  marginAbove != null && marginAbove >= 0
                    ? mobileColors.success
                    : mobileColors.error
              }
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  title: { ...mobileTypography.cardTitle, fontWeight: "800" },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  marginAbove: {
    ...mobileTypography.body,
    fontWeight: "700",
    marginTop: mobileSpacing.sm
  },
  barTrack: {
    height: 8,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    marginTop: mobileSpacing.md,
    overflow: "hidden"
  },
  barFill: { height: "100%", borderRadius: mobileRadius.sm }
});
