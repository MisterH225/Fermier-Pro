import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
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
import { ProducerScoreBadge } from "../../components/marketplace/ProducerScoreBadge";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { fetchMyProducerScore, postRecomputeProducerScore } from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ProducerScoreDashboard">;

function PillarRow({
  label,
  value,
  detail
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <View style={styles.pillar}>
      <View style={styles.pillarHeader}>
        <Text style={styles.pillarLabel}>{label}</Text>
        <Text style={styles.pillarValue}>{value}/100</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, value)}%` }]} />
      </View>
      <Text style={styles.pillarDetail}>{detail}</Text>
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

  const score = scoreQ.data;
  if (!score) {
    return null;
  }

  const chatScore =
    score.chatBuyerMessagesCount > 0
      ? Math.round(
          (score.chatRepliedWithin24h / score.chatBuyerMessagesCount) * 100
        )
      : 70;

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
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("producerScore.dashboard.title")}
        </Text>
        <ProducerScoreBadge score={score} />
        <Text style={styles.globalValue}>
          {t("producerScore.dashboard.global", { value: score.globalValue })}
        </Text>
        <Text style={styles.hint}>{t("producerScore.dashboard.hint")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("producerScore.dashboard.pillarsTitle")}
        </Text>
        <PillarRow
          label={t("producerScore.dashboard.dataRegularity")}
          value={score.dataRegularityScore}
          detail={t("producerScore.dashboard.dataRegularityDetail", {
            days: score.dataEntryDaysLast30
          })}
        />
        <PillarRow
          label={t("producerScore.dashboard.platformUsage")}
          value={score.platformUsageScore}
          detail={t("producerScore.dashboard.platformUsageDetail", {
            days: score.platformActiveDaysLast30
          })}
        />
        <PillarRow
          label={t("producerScore.dashboard.responsiveness")}
          value={score.responsivenessScore}
          detail={t("producerScore.dashboard.responsivenessDetail", {
            responded: score.offersRespondedWithin48h,
            received: score.offersReceivedCount
          })}
        />
        <PillarRow
          label={t("producerScore.dashboard.chatResponsiveness")}
          value={chatScore}
          detail={t("producerScore.dashboard.chatResponsivenessDetail", {
            replied: score.chatRepliedWithin24h,
            messages: score.chatBuyerMessagesCount
          })}
        />
      </View>

      {score.creditBlocked ? (
        <Text style={styles.warning}>{t("producerScore.dashboard.creditBlocked")}</Text>
      ) : !score.creditSalesAllowed ? (
        <Text style={styles.warning}>{t("producerScore.dashboard.creditDenied")}</Text>
      ) : score.creditSalesLimited ? (
        <Text style={styles.hint}>{t("producerScore.dashboard.creditLimited")}</Text>
      ) : null}

      <Pressable
        style={styles.refreshBtn}
        onPress={() => {
          void postRecomputeProducerScore(accessToken!, activeProfileId).then(() =>
            scoreQ.refetch()
          );
        }}
      >
        <Text style={styles.refreshBtnText}>
          {t("producerScore.dashboard.recompute")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mobileColors.surfaceMuted },
  content: { padding: mobileSpacing.md, gap: mobileSpacing.md },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.lg
  },
  error: { ...mobileTypography.body, color: mobileColors.error, textAlign: "center" },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  globalValue: {
    ...mobileTypography.title,
    color: mobileColors.textPrimary
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  pillar: { gap: mobileSpacing.xs, marginTop: mobileSpacing.sm },
  pillarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pillarLabel: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  pillarValue: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  barTrack: {
    height: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill
  },
  pillarDetail: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  warning: {
    ...mobileTypography.body,
    color: mobileColors.error,
    marginTop: mobileSpacing.sm
  },
  refreshBtn: {
    alignSelf: "center",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg
  },
  refreshBtnText: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  }
});
