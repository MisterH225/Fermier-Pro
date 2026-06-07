import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CreditScoreBadge } from "../../components/marketplace/CreditScoreBadge";
import { BalanceTrackingCard } from "../../components/marketplace/BalanceTrackingCard";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { fetchCreditPendingOffers, fetchMyCreditScore } from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreditDashboard">;

export function CreditDashboardScreen(_props: Props) {
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();

  const scoreQ = useQuery({
    queryKey: ["myCreditScore", activeProfileId],
    queryFn: () => fetchMyCreditScore(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const pendingQ = useQuery({
    queryKey: ["creditPending", activeProfileId],
    queryFn: () => fetchCreditPendingOffers(accessToken!, undefined, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const refreshing = scoreQ.isFetching || pendingQ.isFetching;

  if (scoreQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  const err = scoreQ.error
    ? getUserFacingError(scoreQ.error, t)
    : pendingQ.error
      ? getUserFacingError(pendingQ.error, t)
      : null;

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
      </View>
    );
  }

  const score = scoreQ.data;
  const pending = pendingQ.data ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void scoreQ.refetch();
            void pendingQ.refetch();
          }}
          tintColor={mobileColors.accent}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("marketScreen.credit.dashboard.scoreTitle")}
        </Text>
        <CreditScoreBadge score={score} />
        {score ? (
          <View style={styles.stats}>
            <Text style={styles.statLine}>
              {t("marketScreen.credit.dashboard.transactions", {
                count: score.creditTransactionsCount
              })}
            </Text>
            <Text style={styles.statLine}>
              {t("marketScreen.credit.dashboard.onTime", {
                count: score.creditOnTimeCount
              })}
            </Text>
            <Text style={styles.statLine}>
              {t("marketScreen.credit.dashboard.late", {
                count: score.creditLateCount
              })}
            </Text>
          </View>
        ) : null}
        {score?.blocked ? (
          <Text style={styles.blocked}>{t("marketScreen.creditModal.blocked")}</Text>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>
        {t("marketScreen.credit.dashboard.pendingTitle")}
      </Text>
      {pending.length === 0 ? (
        <Text style={styles.empty}>{t("marketScreen.credit.dashboard.empty")}</Text>
      ) : (
        pending.map((row) => (
          <BalanceTrackingCard
            key={row.id}
            balanceAmount={row.balanceAmount}
            currency={row.currency}
            balanceDueAt={row.balanceDueAt}
            status={row.status}
            listingTitle={row.listingTitle}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: mobileColors.canvas },
  content: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
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
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  stats: { gap: 4, marginTop: mobileSpacing.sm },
  statLine: { ...mobileTypography.body, color: mobileColors.textSecondary },
  blocked: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    marginTop: mobileSpacing.sm
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  }
});
