import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { ProfitabilityInsightDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { marketplaceColors } from "../../theme/marketplaceTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  insights: ProfitabilityInsightDto[];
  isLoading: boolean;
  available: boolean;
  onRefresh?: () => void;
};

const PRIORITY_COLOR: Record<string, string> = {
  high: uiNamedColors.cDC2626,
  medium: marketplaceColors.pending,
  low: uiNamedColors.c2563EB
};

export function ProfitabilityInsightsCard({
  insights,
  isLoading,
  available,
  onRefresh
}: Props) {
  const { t } = useTranslation();

  if (!available && !isLoading) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("profitability.aiTitle")}</Text>
        {onRefresh ? (
          <Pressable onPress={onRefresh}>
            <Text style={styles.refresh}>{t("profitability.aiRefresh")}</Text>
          </Pressable>
        ) : null}
      </View>
      {isLoading ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : (
        insights.map((insight, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardTop}>
              <View
                style={[
                  styles.priorityDot,
                  {
                    backgroundColor:
                      PRIORITY_COLOR[insight.priority] ?? mobileColors.accent
                  }
                ]}
              />
              <Text style={styles.cardTitle}>{insight.title}</Text>
            </View>
            <Text style={styles.obs}>{insight.observation}</Text>
            <Text style={styles.rec}>{insight.recommendation}</Text>
            <Text style={styles.impact}>{insight.potentialImpact}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: { ...mobileTypography.cardTitle, fontWeight: "800" },
  refresh: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  priorityDot: { width: 10, height: 10, borderRadius: mobileRadius.sm },
  cardTitle: { ...mobileTypography.body, fontWeight: "800", flex: 1 },
  obs: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  rec: { ...mobileTypography.body, marginTop: mobileSpacing.xs },
  impact: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "600",
    marginTop: mobileSpacing.xs
  }
});
