import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatPredictionDate } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  locale: string;
  onOrderPress?: (feedTypeId: string, quantityKg: number) => void;
};

export function CommandeRecommandeeCard({
  payload,
  locale,
  onOrderPress
}: Props) {
  const { t } = useTranslation();
  const recommendations = payload.stock_predictions.feed_needs.filter(
    (f) => f.reorder_quantity_kg > 0
  );

  if (!recommendations.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📦 {t("predictions.commandeRecommandeeTitle")}</Text>
      {recommendations.slice(0, 3).map((feed) => (
        <View key={feed.feed_type_id} style={styles.row}>
          <Text style={styles.name}>{feed.feed_type_name}</Text>
          <Text style={styles.qty}>
            {t("predictions.reorderQty", {
              kg: Math.round(feed.reorder_quantity_kg)
            })}
          </Text>
          <Text style={styles.date}>
            {t("predictions.reorderDate", {
              date: formatPredictionDate(feed.reorder_recommended_date, locale)
            })}
          </Text>
          {onOrderPress ? (
            <Pressable
              style={styles.cta}
              onPress={() =>
                onOrderPress(feed.feed_type_id, feed.reorder_quantity_kg)
              }
            >
              <Text style={styles.ctaText}>{t("predictions.recordStockEntry")}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  title: { ...mobileTypography.cardTitle },
  row: { gap: 4 },
  name: { ...mobileTypography.body, fontWeight: "600" },
  qty: { ...mobileTypography.body },
  date: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  cta: {
    marginTop: mobileSpacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md
  },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 13 }
});
