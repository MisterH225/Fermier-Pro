import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MeteoProgressBar } from "../../components/common/MeteoProgressBar";
import {
  buildProducerScorePillarsV1,
  type MeteoPillarView
} from "../../components/meteo/meteoPillars";
import { getMeteoProgress } from "../../constants/meteoProfil";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { fetchMyProducerScore, postRecomputeProducerScore } from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { producerColors } from "../../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "ProducerScoreDashboard">;

const CHART_BAR_MAX_HEIGHT = 112;

function barColor(value: number): string {
  if (value >= 75) return producerColors.scoreGood;
  if (value >= 50) return producerColors.scoreMid;
  return producerColors.scoreLow;
}

function iconBgColor(scoreColor: string | undefined): string {
  if (!scoreColor) return producerColors.scoreIconBg;
  return `${scoreColor}22`;
}

function InsightCard({
  icon,
  iconColor,
  iconBg,
  title,
  children
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.insightCard, mobileShadows.card]}>
      <View style={[styles.insightIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.insightTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PillarsBarChart({ pillars }: { pillars: MeteoPillarView[] }) {
  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartBars}>
        {pillars.map((pillar) => {
          const height = Math.max(
            6,
            Math.round((pillar.score / 100) * CHART_BAR_MAX_HEIGHT)
          );
          const color = barColor(pillar.score);
          const short =
            pillar.shortLabel ??
            pillar.label ??
            pillar.shortLabelKey ??
            pillar.labelKey;
          return (
            <View key={pillar.key} style={styles.chartCol}>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    { height, backgroundColor: color }
                  ]}
                />
              </View>
              <Text style={styles.chartLabel} numberOfLines={1}>
                {short}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ProducerScoreDashboardScreen(_props: Props) {
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();

  const scoreQ = useQuery({
    queryKey: ["myProducerScore", activeProfileId],
    queryFn: () => fetchMyProducerScore(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const score = scoreQ.data;

  const chatScore = useMemo(() => {
    if (!score) return 70;
    if (score.chatBuyerMessagesCount > 0) {
      return Math.round(
        (score.chatRepliedWithin24h / score.chatBuyerMessagesCount) * 100
      );
    }
    return 70;
  }, [score]);

  /** Liste dynamique de piliers — prête pour trust-score v2 (labelKey / hint). */
  const pillars = useMemo<MeteoPillarView[]>(() => {
    if (!score) return [];
    return buildProducerScorePillarsV1(
      {
        dataRegularityScore: score.dataRegularityScore,
        platformUsageScore: score.platformUsageScore,
        responsivenessScore: score.responsivenessScore,
        chatScore,
        dataEntryDaysLast30: score.dataEntryDaysLast30,
        platformActiveDaysLast30: score.platformActiveDaysLast30,
        offersRespondedWithin48h: score.offersRespondedWithin48h,
        offersReceivedCount: score.offersReceivedCount,
        chatRepliedWithin24h: score.chatRepliedWithin24h,
        chatBuyerMessagesCount: score.chatBuyerMessagesCount
      },
      t
    );
  }, [score, chatScore, t]);

  const bestPillar = useMemo(() => {
    if (pillars.length === 0) return null;
    return [...pillars].sort((a, b) => b.score - a.score)[0];
  }, [pillars]);

  if (scoreQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  const err = scoreQ.error ? getUserFacingError(scoreQ.error, t) : null;
  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
      </View>
    );
  }

  if (!score) {
    return null;
  }

  const tierColor = score.color || mobileColors.accent;
  const tierAchievement = score.creditBlocked
    ? {
        title: t("producerScore.dashboard.achievementCreditBlockedTitle"),
        body: t("producerScore.dashboard.achievementCreditBlockedBody")
      }
    : !score.creditSalesAllowed
      ? {
          title: t("producerScore.dashboard.achievementCreditDeniedTitle"),
          body: t("producerScore.dashboard.achievementCreditDeniedBody")
        }
      : score.creditSalesLimited
        ? {
            title: t("producerScore.dashboard.achievementCreditLimitedTitle"),
            body: t("producerScore.dashboard.achievementCreditLimitedBody")
          }
        : score.globalValue >= 75
          ? {
              title: t("producerScore.dashboard.achievementTierTitle"),
              body: t("producerScore.dashboard.achievementTierBody")
            }
          : {
              title: t("producerScore.dashboard.achievementProgressTitle"),
              body: t("producerScore.dashboard.achievementProgressBody", {
                value: score.globalValue
              })
            };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      refreshControl={
        <RefreshControl
          refreshing={scoreQ.isFetching}
          onRefresh={() => void scoreQ.refetch()}
          tintColor={mobileColors.accent}
        />
      }
    >
      <View style={[styles.heroCard, mobileShadows.card]}>
        <View style={styles.heroTopRow}>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: iconBgColor(score.color) }
            ]}
          >
            <Text style={styles.heroEmoji}>{score.emoji}</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{score.label}</Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={mobileColors.textSecondary}
            />
          </View>
        </View>

        <Text style={styles.heroMetricLabel}>
          {t("producerScore.dashboard.metricTitle")}
        </Text>
        <View style={styles.heroMetricRow}>
          <Text style={styles.heroMetricValue}>{score.globalValue}</Text>
          <Text style={styles.heroMetricUnit}>/100</Text>
        </View>
        <View style={styles.heroProgress}>
          <MeteoProgressBar
            progress={getMeteoProgress(score.globalValue)}
            color={tierColor}
            trackColor={`${tierColor}33`}
          />
        </View>
        <Text style={styles.heroHint}>{t("producerScore.dashboard.hint")}</Text>
      </View>

      <View style={styles.insightRow}>
        <InsightCard
          icon="leaf"
          iconColor={producerColors.primary}
          iconBg={producerColors.primaryLight}
          title={t("producerScore.dashboard.achievementBestTitle")}
        >
          <Text style={styles.insightBody}>
            {bestPillar
              ? t("producerScore.dashboard.achievementBestBody", {
                  pillar: bestPillar.label ?? bestPillar.labelKey,
                  value: bestPillar.score
                })
              : t("producerScore.dashboard.achievementBestFallback")}
          </Text>
        </InsightCard>

        <InsightCard
          icon="trophy"
          iconColor={mobileColors.warning}
          iconBg={producerColors.scoreIconBg}
          title={tierAchievement.title}
        >
          <Text style={styles.insightBody}>{tierAchievement.body}</Text>
        </InsightCard>
      </View>

      <View style={[styles.chartCard, mobileShadows.card]}>
        <Text style={styles.chartTitle}>
          {t("producerScore.dashboard.chartTitle")}
        </Text>
        <PillarsBarChart pillars={pillars} />
        <View style={styles.pillarDetails}>
          {pillars.map((pillar) => (
            <View key={pillar.key} style={styles.pillarDetailRow}>
              <View style={styles.pillarDetailHeader}>
                <Text style={styles.pillarDetailLabel}>
                  {pillar.label ?? pillar.labelKey}
                </Text>
                <Text style={[styles.pillarDetailValue, { color: tierColor }]}>
                  {pillar.score}/100
                </Text>
              </View>
              {pillar.hint ? (
                <Text style={styles.pillarDetailMeta}>{pillar.hint}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {score.scoreUpdatedAt ? (
        <Text style={styles.updatedAt}>
          {t("producerScore.dashboard.updatedAt", {
            date: new Date(score.scoreUpdatedAt).toLocaleDateString()
          })}
        </Text>
      ) : null}

      <Pressable
        style={styles.refreshBtn}
        onPress={() => {
          void postRecomputeProducerScore(accessToken!, activeProfileId).then(() =>
            scoreQ.refetch()
          );
        }}
      >
        <Text style={[styles.refreshBtnText, { color: tierColor }]}>
          {t("producerScore.dashboard.recompute")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mobileColors.canvas },
  content: { padding: mobileSpacing.lg, gap: mobileSpacing.lg },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.canvas
  },
  error: { ...mobileTypography.body, color: mobileColors.error, textAlign: "center" },
  heroCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center"
  },
  heroEmoji: { fontSize: mobileFontSize.xl },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  heroPillText: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  heroMetricLabel: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  heroMetricRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4
  },
  heroMetricValue: {
    fontSize: mobileFontSize.xxl,
    lineHeight: 44,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  heroMetricUnit: {
    fontSize: mobileFontSize.xl,
    lineHeight: 32,
    fontWeight: "500",
    color: mobileColors.textSecondary,
    marginBottom: 2
  },
  heroProgress: {
    marginTop: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs
  },
  heroHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  insightRow: {
    flexDirection: "row",
    gap: mobileSpacing.md
  },
  insightCard: {
    flex: 1,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    minHeight: 132
  },
  insightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: mobileRadius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  insightTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  insightBody: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18
  },
  chartCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  chartTitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  chartWrap: { paddingTop: mobileSpacing.xs },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: mobileSpacing.sm,
    minHeight: CHART_BAR_MAX_HEIGHT + 8
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  chartBarTrack: {
    height: CHART_BAR_MAX_HEIGHT,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center"
  },
  chartBar: {
    width: "72%",
    maxWidth: 36,
    borderRadius: mobileRadius.md,
    minHeight: 6
  },
  chartLabel: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  pillarDetails: { gap: mobileSpacing.md, marginTop: mobileSpacing.xs },
  pillarDetailRow: { gap: 2 },
  pillarDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pillarDetailLabel: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    flex: 1,
    paddingRight: mobileSpacing.sm
  },
  pillarDetailValue: {
    ...mobileTypography.meta,
    fontWeight: "700"
  },
  pillarDetailMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  updatedAt: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  refreshBtn: {
    alignSelf: "center",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg
  },
  refreshBtnText: {
    ...mobileTypography.body,
    fontWeight: "600"
  }
});
