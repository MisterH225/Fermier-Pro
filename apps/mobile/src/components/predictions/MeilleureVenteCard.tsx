import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatCurrency, formatPredictionDate } from "./predictionFormatters";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  payload: FarmPredictionsPayload;
  currency: string;
  locale: string;
};

const TREND_BADGE = {
  hausse: "📈 Hausse",
  stable: "➡️ Stable",
  baisse: "📉 Baisse"
} as const;

export function MeilleureVenteCard({ payload, currency, locale }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const optimal = payload.sale_timing?.optimal_window;
  if (!optimal) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🎯 {t("predictions.meilleureVenteTitle")}</Text>
      <Text style={styles.window}>
        {t("predictions.saleWindow", {
          start: formatPredictionDate(optimal.start_date, locale),
          end: formatPredictionDate(optimal.end_date, locale)
        })}
      </Text>
      <Text style={styles.price}>
        {t("predictions.expectedPrice", {
          price: formatCurrency(optimal.expected_price_per_kg, currency, locale)
        })}
        /kg
      </Text>
      <Text style={styles.reason}>{optimal.reason}</Text>
      {payload.sale_timing?.price_trend ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {TREND_BADGE[payload.sale_timing.price_trend]}
          </Text>
        </View>
      ) : null}
      {payload.sale_timing?.price_trend_explanation ? (
        <Text style={styles.trendExpl}>
          {payload.sale_timing.price_trend_explanation}
        </Text>
      ) : null}
      {(payload.sale_timing?.avoid_windows ?? []).slice(0, 2).map((w, i) => (
        <Text key={i} style={styles.avoid}>
          ⚠️ {formatPredictionDate(w.start_date, locale)} — {w.reason}
        </Text>
      ))}
      <Pressable
        style={styles.cta}
        onPress={() => navigation.navigate("MarketplaceList")}
      >
        <Text style={styles.ctaText}>{t("predictions.createListing")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  title: { ...mobileTypography.cardTitle },
  window: { ...mobileTypography.body, fontWeight: "600" },
  price: { ...mobileTypography.body, color: mobileColors.accent },
  reason: { ...mobileTypography.body, color: mobileColors.textSecondary },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: mobileColors.surfaceMuted,
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill
  },
  badgeText: { ...mobileTypography.meta, fontWeight: "600" },
  trendExpl: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  avoid: { ...mobileTypography.meta, color: uiNamedColors.cBA7517 },
  cta: {
    marginTop: mobileSpacing.sm,
    backgroundColor: mobileColors.accent,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  ctaText: { color: mobileColors.background, fontWeight: "600" }
});
