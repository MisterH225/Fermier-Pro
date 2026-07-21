import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { AIInsight, AIInsightPriority } from "../../services/ai/aiTypes";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { navigateFromInsightRoute } from "../../services/navigation/DeepNavigationService";
import type { RootStackParamList } from "../../types/navigation";
import { merchantColors } from "../../theme/merchantTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  insights: AIInsight[];
  loading?: boolean;
  onRefresh?: () => void;
};

const INSIGHT_BLUE = uiNamedColors.c2563EB;
const INSIGHT_BLUE_SOFT = uiNamedColors.cEFF6FF;
const INSIGHT_BLUE_SHIMMER = merchantColors.blueSoftBg;

const PRIORITY_ACCENT: Record<AIInsightPriority, string> = {
  critical: mobileColors.error,
  warning: mobileColors.warning,
  info: INSIGHT_BLUE
};

function InsightCardItem({
  insight,
  onRefresh,
  onNavigate
}: {
  insight: AIInsight;
  onRefresh?: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const accent = PRIORITY_ACCENT[insight.priority];

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.head}>
        <Text style={styles.badge}>✨ {t("ai.insightTitle")}</Text>
        {onRefresh ? (
          <Pressable
            onPress={onRefresh}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("ai.refresh")}
          >
            <Ionicons name="refresh-outline" size={16} color={mobileColors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.insightTitle}>{insight.title}</Text>
      <Text style={styles.message}>{insight.message}</Text>
      {insight.action_label && insight.action_route ? (
        <Pressable style={styles.cta} onPress={onNavigate}>
          <Text style={styles.ctaText}>{insight.action_label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InsightCard({ insights, loading, onRefresh }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (loading && insights.length === 0) {
    return (
      <View style={[styles.card, styles.skeleton, { borderLeftColor: INSIGHT_BLUE }]}>
        <Text style={styles.badge}>{t("ai.insightTitle")}</Text>
        <View style={styles.shimmerRow} />
        <View style={[styles.shimmerRow, styles.shimmerShort]} />
      </View>
    );
  }

  if (!insights.length) {
    return null;
  }

  const navigateAction = (route: string | null | undefined) => {
    navigateFromInsightRoute(navigation, route);
  };

  return (
    <View style={styles.wrap}>
      {insights.map((insight, i) => (
        <InsightCardItem
          key={`${insight.type}-${insight.title}-${i}`}
          insight={insight}
          onRefresh={i === 0 ? onRefresh : undefined}
          onNavigate={() => navigateAction(insight.action_route)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  card: {
    backgroundColor: INSIGHT_BLUE_SOFT,
    borderRadius: mobileRadius.md,
    borderLeftWidth: 3,
    padding: mobileSpacing.md,
    ...mobileShadows.card
  },
  skeleton: {
    opacity: 0.85
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.xs
  },
  badge: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  insightTitle: {
    fontSize: mobileFontSize.md,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    marginBottom: 4
  },
  message: {
    fontSize: mobileFontSize.md,
    lineHeight: 20,
    color: mobileColors.textPrimary
  },
  cta: {
    marginTop: mobileSpacing.sm,
    alignSelf: "flex-start"
  },
  ctaText: {
    fontSize: mobileFontSize.md,
    fontWeight: "600",
    color: mobileColors.accent
  },
  shimmerRow: {
    height: 12,
    borderRadius: mobileRadius.sm,
    backgroundColor: INSIGHT_BLUE_SHIMMER,
    marginTop: mobileSpacing.sm,
    width: "92%"
  },
  shimmerShort: {
    width: "60%"
  }
});
