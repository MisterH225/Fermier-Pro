import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type F = {
  feedInKg?: string;
  feedCost?: string;
  stockChecks?: number;
  costPerHeadDay?: number;
  ratioFeedRevenuesPct?: number | null;
  consumptionByType?: Array<{ name: string; consumedKg: string }>;
  stockBreakTypes?: number;
};

export function FeedSummary({ feed }: { feed: F | undefined }) {
  const { t } = useTranslation();
  if (!feed) {
    return (
      <Text style={styles.muted}>{t("reportsScreen.sectionNoData")}</Text>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🌾 {t("reportsScreen.feedTitle")}</Text>
      <Text style={styles.line}>
        {t("reportsScreen.feedInKg")}: {feed.feedInKg ?? "0"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.feedCost")}: {feed.feedCost ?? "0"}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.costPerHeadDay")}:{" "}
        {Number(feed.costPerHeadDay ?? 0).toFixed(4)}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.stockChecks")}: {feed.stockChecks ?? 0}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.stockBreaks")}: {feed.stockBreakTypes ?? 0}
      </Text>
      <Text style={styles.line}>
        {t("reportsScreen.feedRevRatio")}:{" "}
        {feed.ratioFeedRevenuesPct != null
          ? `${feed.ratioFeedRevenuesPct.toFixed(1)}%`
          : "—"}
      </Text>
      {feed.consumptionByType?.length ? (
        <>
          <Text style={styles.sub}>{t("reportsScreen.consumptionByType")}</Text>
          {feed.consumptionByType.map((r) => (
            <Text key={r.name} style={styles.line}>
              • {r.name}: {r.consumedKg} kg
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    gap: mobileSpacing.xs
  },
  title: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  sub: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  line: { ...mobileTypography.body, color: mobileColors.textPrimary },
  muted: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
