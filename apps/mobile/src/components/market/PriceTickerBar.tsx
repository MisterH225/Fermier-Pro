import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { PigPriceIndexTickerDto } from "../../lib/api";

type Props = {
  data: PigPriceIndexTickerDto | undefined;
};

function variationLabel(
  v: number | null,
  flatLabel: string
): { text: string; color: string } {
  if (v == null || !Number.isFinite(v)) {
    return { text: flatLabel, color: "#868E96" };
  }
  const sign = v > 0 ? "+" : "";
  const emoji = v > 0 ? "📈" : v < 0 ? "📉" : "➡️";
  const color = v > 0 ? "#2F9E44" : v < 0 ? "#E03131" : "#868E96";
  return { text: `${sign}${v.toFixed(1)}% ${emoji}`, color };
}

export function PriceTickerBar({ data }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -600,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    anim.start();
    return () => anim.stop();
  }, [scrollX]);

  const formatPrice = (n: number | null): string => {
    if (n == null || !Number.isFinite(n)) {
      return t("pigPriceIndex.priceOnRequest");
    }
    return `${Math.round(n).toLocaleString(locale)} ${t("pigPriceIndex.unit")}`;
  };

  const items = data?.items ?? [];
  const doubled = [...items, ...items];
  const flatLabel = t("pigPriceIndex.variationFlat");

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}>
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollX }] }]}>
          {doubled.map((item, i) => {
            const varInfo = variationLabel(item.variationPct, flatLabel);
            return (
              <View key={`${item.category}-${i}`} style={styles.chip}>
                <Text style={styles.chipText}>
                  {item.icon} {item.label} :{" "}
                  <Text style={{ color: item.color, fontWeight: "700" }}>
                    {formatPrice(item.pricePerKg)}
                  </Text>{" "}
                  <Text style={{ color: varInfo.color }}>{varInfo.text}</Text>
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#1A1D23",
    borderRadius: 10,
    paddingVertical: mobileSpacing.sm
  },
  row: { flexDirection: "row", gap: mobileSpacing.lg, paddingHorizontal: mobileSpacing.md },
  chip: { paddingRight: mobileSpacing.lg },
  chipText: { ...mobileTypography.meta, color: "#E9ECEF", fontSize: 13 }
});
