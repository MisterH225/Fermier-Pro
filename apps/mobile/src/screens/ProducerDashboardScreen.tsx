import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { MobileAppShell } from "../components/layout";
import { FarmDashboardAISection } from "../components/ai/FarmModuleAISection";
import { NotificationsHeaderButton } from "../components/notifications/NotificationsHeaderButton";
import { ShopOrdersTrackingCard } from "../components/notifications/ShopOrdersTrackingCard";

import { FeedStockLevelGauge, dashboardFeedItemEligibleForGauge, dashboardFeedItemToGauge } from "../components/feed";
import { FinanceOverviewKpiGrid } from "../components/finance/FinanceOverviewKpiGrid";
import { RentabilityHeroCard } from "../components/profitability/RentabilityHeroCard";
import { CategoryBreakdownPanel } from "../components/cheptel/overview/CategoryBreakdownPanel";
import { ScreenSection } from "../components/layout/ScreenSection";
import { EmptyStateCard } from "../components/common/EmptyStateCard";
import { CardContentSkeleton } from "../components/common/SkeletonBlocks";
import { OnboardingBanner } from "../components/onboarding/OnboardingBanner";
import { PendingInvitationsBanner } from "../components/collaboration/PendingInvitationsBanner";
import { VetAppointmentActionsBanner } from "../components/vet/VetAppointmentActionsBanner";
import { ProducerActiveProposalsSection } from "../components/producer/ProducerActiveProposalsSection";
import { ProducerPendingMarketplaceBanner } from "../components/producer/ProducerPendingMarketplaceBanner";
import { ProducerProfileModal } from "../components/producer/ProducerProfileModal";
import { MeteoProfilCard } from "../components/dashboard/MeteoProfilCard";
import { ProducerWelcomeHeader } from "../components/producer/ProducerWelcomeHeader";
import { WalletDashboardCard } from "../components/wallet/WalletDashboardCard";
import { SupportHeaderButton } from "../components/support/SupportHeaderButton";
import { ProjectIndicator } from "../components/projects";
import { useOnboardingResume } from "../context/OnboardingResumeContext";
import { useActiveProject, useActiveFarm } from "../context/ActiveProjectContext";
import { getProducerOnboardingState } from "../lib/onboardingState";
import { useBottomInset } from "../hooks/useBottomInset";
import { resolveActiveProfileAvatarUrl } from "../lib/profileAvatar";
import { useSession } from "../context/SessionContext";
import {
  fetchDashboardFeedStock,
  fetchFinanceOverview,
  fetchFarmCheptelOverview,
  fetchFarmProfitabilityDashboard,
  fetchDashboardGestations,
  fetchDashboardHealth,
  fetchFarms,
  fetchMyProducerScore,
  postFarmSmartAlertsRefresh,
  type DashboardFeedStockItemDto,
  type DashboardGestationItemDto,
  type FinanceOverviewDto,
  type DashboardHealthDto
} from "../lib/api";
import { welcomeFirstName } from "../lib/userDisplay";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";

function formatMoney(n: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return String(Math.round(n));
  }
}

function formatDay(iso: string | null | undefined, locale: string): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short"
  });
}

/**
 * Tableau de bord producteur : cartes pilotées par l’API (aucune donnée locale fictive).
 * Finance : grille KPI via FinanceOverviewKpiGrid (plus de SmartChart ici).
 */
export function ProducerDashboardScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en" : "fr";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

  const {
    accessToken,
    activeProfileId,
    authMe,
    clientFeatures
  } = useSession();
  const { activeFarm, activeFarmId, farms, refreshFarms } = useActiveProject();
  const bottomInset = useBottomInset();
  const { requestResume } = useOnboardingResume();
  const onboardingState = getProducerOnboardingState(authMe, activeProfileId);
  const showOnboardingBanner = onboardingState === "skipped";
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profitabilityPeriod, setProfitabilityPeriod] = useState<
    "current_month" | "current_quarter" | "current_year"
  >("current_month");
  const user = authMe?.user;
  const firstName = useMemo(() => welcomeFirstName(user), [user]);

  const activeProfile = useMemo(() => {
    if (!authMe || !activeProfileId) {
      return null;
    }
    return authMe.profiles.find((p) => p.id === activeProfileId) ?? null;
  }, [authMe, activeProfileId]);

  const isProducer = activeProfile?.type === "producer";
  const showMultiProjectIndicator = farms.filter(f => f.status === "active").length > 1;

  const farmId = activeFarmId;
  const farmName = activeFarm?.name ?? "";

  const financeEnabled = Boolean(
    farmId && accessToken && clientFeatures.finance
  );
  const feedEnabled = Boolean(
    farmId && accessToken && clientFeatures.feedStock
  );

  const financeQuery = useQuery({
    queryKey: ["financeOverview", farmId, activeProfileId],
    queryFn: () =>
      fetchFinanceOverview(accessToken!, farmId!, activeProfileId),
    enabled: financeEnabled,
    refetchInterval: 60_000
  });

  const profitabilityQuery = useQuery({
    queryKey: [
      "profitabilityDashboard",
      farmId,
      profitabilityPeriod,
      activeProfileId
    ],
    queryFn: () =>
      fetchFarmProfitabilityDashboard(
        accessToken!,
        farmId!,
        activeProfileId,
        profitabilityPeriod
      ),
    enabled: financeEnabled,
    refetchInterval: 120_000
  });

  const gestationsQuery = useQuery({
    queryKey: ["dashboardGestations", farmId, activeProfileId],
    queryFn: () =>
      fetchDashboardGestations(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(farmId && accessToken),
    refetchInterval: 60_000
  });

  const healthQuery = useQuery({
    queryKey: ["dashboardHealth", farmId, activeProfileId],
    queryFn: () =>
      fetchDashboardHealth(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(farmId && accessToken),
    refetchInterval: 60_000
  });

  const feedQuery = useQuery({
    queryKey: ["dashboardFeedStock", farmId, activeProfileId],
    queryFn: () =>
      fetchDashboardFeedStock(accessToken!, farmId!, activeProfileId),
    enabled: feedEnabled,
    refetchInterval: 60_000
  });

  const cheptelOverviewQ = useQuery({
    queryKey: ["cheptelOverview", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmCheptelOverview(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(farmId && accessToken),
    refetchInterval: 120_000
  });

  const producerScoreQ = useQuery({
    queryKey: ["myProducerScore", activeProfileId],
    queryFn: () => fetchMyProducerScore(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useEffect(() => {
    if (!farmId || !accessToken) {
      return;
    }
    void postFarmSmartAlertsRefresh(accessToken, farmId, activeProfileId)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
        void qc.invalidateQueries({
          queryKey: ["smartAlerts", farmId, activeProfileId, "count"]
        });
      })
      .catch(() => undefined);
  }, [farmId, accessToken, activeProfileId, qc]);

  const onRefresh = useCallback(async () => {
    if (!farmId) {
      return;
    }
    setRefreshing(true);
    const tasks: Promise<unknown>[] = [];
    if (financeEnabled) {
      tasks.push(financeQuery.refetch(), profitabilityQuery.refetch());
    }
    tasks.push(gestationsQuery.refetch(), healthQuery.refetch());
    tasks.push(cheptelOverviewQ.refetch());
    if (feedEnabled) {
      tasks.push(feedQuery.refetch());
    }
    await Promise.all(tasks.map((p) => p.catch(() => undefined)));
    await refreshFarms().catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["farms", activeProfileId] });
    if (farmId && accessToken) {
      await postFarmSmartAlertsRefresh(
        accessToken,
        farmId,
        activeProfileId
      ).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
      void qc.invalidateQueries({
        queryKey: ["smartAlerts", farmId, activeProfileId, "count"]
      });
    }
    setRefreshing(false);
  }, [
    farmId,
    accessToken,
    activeProfileId,
    financeEnabled,
    feedEnabled,
    financeQuery,
    profitabilityQuery,
    gestationsQuery,
    healthQuery,
    feedQuery,
    refreshFarms,
    qc
  ]);

  const dashboardHeader = (
    <View style={styles.heroBar}>
      <View style={styles.heroHeaderRow}>
        <View style={styles.heroWelcomeCluster}>
          <ProducerWelcomeHeader
            welcomeLabel={t("producer.welcomeLine")}
            firstName={firstName}
            avatarUrl={resolveActiveProfileAvatarUrl(authMe, activeProfileId)}
            onPressAvatar={() => setProfileOpen(true)}
          />
          {showMultiProjectIndicator ? (
            <ProjectIndicator onPress={() => setProfileOpen(true)} />
          ) : null}
        </View>
        <View style={styles.heroActions}>
          <NotificationsHeaderButton
            iconColor={mobileColors.accent}
            farmId={farmId}
            farmName={farmName}
            style={styles.heroIconBtn}
          />
          <SupportHeaderButton
            iconColor={mobileColors.accent}
            style={styles.heroIconBtn}
          />
          <Pressable
            onPress={() => {
              if (!farmId || !farmName) {
                navigation.navigate("FarmList");
                return;
              }
              navigation.navigate("ProducerFarmSettings", { farmId, farmName });
            }}
            style={({ pressed }) => [
              styles.heroIconBtn,
              pressed && styles.heroIconBtnPressed
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("producer.settingsButton")}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={mobileColors.accent}
            />
          </Pressable>
        </View>
      </View>
      {accessToken ? <WalletDashboardCard variant="producer" /> : null}
    </View>
  );

  return (
    <>
      <MobileAppShell customHeader={dashboardHeader} omitBottomTabBar>
        <ScrollView
          contentContainerStyle={[
            styles.wrap,
            { paddingBottom: bottomInset }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <PendingInvitationsBanner />
          <ShopOrdersTrackingCard />
          {clientFeatures.marketplace ? (
            <ProducerPendingMarketplaceBanner farmId={farmId} />
          ) : null}
          {accessToken && farmId ? (
            <VetAppointmentActionsBanner
              accessToken={accessToken}
              activeProfileId={activeProfileId}
              farmId={farmId}
            />
          ) : null}
          {showOnboardingBanner ? (
            <OnboardingBanner onComplete={requestResume} />
          ) : null}
          {producerScoreQ.data ? (
            <MeteoProfilCard
              score={producerScoreQ.data.globalValue}
              onPress={() => navigation.navigate("ProducerScoreDashboard")}
            />
          ) : null}
          {clientFeatures.marketplace && farmId ? (
            <ProducerActiveProposalsSection farmId={farmId} />
          ) : null}
          {!farmId ? (
            showOnboardingBanner ? (
              <EmptyStateCard onConfigure={requestResume} />
            ) : (
              <View style={styles.emptyFarm}>
                <Text style={styles.emptyTitle}>
                  {t("producer.dashboard.noFarmTitle")}
                </Text>
                <Text style={styles.emptyBody}>
                  {t("producer.dashboard.noFarmBody")}
                </Text>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => navigation.navigate("FarmList")}
                >
                  <Text style={styles.linkBtnText}>
                    {t("producer.dashboard.openFarmList")}
                  </Text>
                </Pressable>
              </View>
            )
          ) : (
            <>
            {financeEnabled ? (
              <View style={styles.heroRentability}>
                <RentabilityHeroCard
                  data={profitabilityQuery.data}
                  isLoading={profitabilityQuery.isPending}
                  currencySymbol={
                    (financeQuery.data as FinanceOverviewDto | undefined)
                      ?.settings.currencySymbol ?? "FCFA"
                  }
                  period={profitabilityPeriod}
                  onPeriodChange={setProfitabilityPeriod}
                  onPressDetail={() =>
                    navigation.navigate("FarmFinance", {
                      farmId,
                      farmName,
                      initialTab: "rentabilite"
                    })
                  }
                />
              </View>
            ) : null}
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <FinanceOverviewKpiGrid
                  enabled={financeEnabled}
                  overview={financeQuery.data as FinanceOverviewDto | undefined}
                  isPending={financeQuery.isPending}
                  error={
                    financeQuery.error instanceof Error
                      ? getUserFacingError(financeQuery.error, t)
                      : null
                  }
                  sectionTitle={t("producer.dashboard.financeTitle")}
                  disabledHint={t("producer.dashboard.financeDisabled")}
                  onPress={() =>
                    navigation.navigate("FarmFinance", { farmId, farmName })
                  }
                />
              </View>

              <View style={styles.gridItem}>
                <GestationsCard
                  items={gestationsQuery.data?.items}
                  isPending={gestationsQuery.isPending}
                  error={
                    gestationsQuery.error instanceof Error
                      ? getUserFacingError(gestationsQuery.error, t)
                      : null
                  }
                  locale={locale}
                  title={t("producer.dashboard.gestationsTitle")}
                  dayAbbr={t("producer.dashboard.dayAbbr")}
                  urgentLabel={t("producer.dashboard.urgentBadge")}
                  onPress={() =>
                    navigation.navigate("FarmLivestock", { farmId, farmName })
                  }
                />
              </View>

              <View style={styles.gridItem}>
                <HealthCard
                  data={healthQuery.data}
                  isPending={healthQuery.isPending}
                  error={
                    healthQuery.error instanceof Error
                      ? getUserFacingError(healthQuery.error, t)
                      : null
                  }
                  locale={locale}
                  title={t("producer.dashboard.healthTitle")}
                  labels={{
                    vaccines: t("producer.dashboard.healthVaccines"),
                    vet: t("producer.dashboard.healthVet"),
                    diseases: t("producer.dashboard.healthDiseases"),
                    mortality: t("producer.dashboard.healthMortality")
                  }}
                  dayAbbr={t("producer.dashboard.dayAbbr")}
                  onPress={() =>
                    navigation.navigate("FarmHealth", {
                      farmId,
                      farmName,
                      initialTab:
                        (healthQuery.data?.activeDiseaseCases?.count ?? 0) > 0
                          ? "disease"
                          : undefined
                    })
                  }
                />
              </View>

              <View style={styles.gridItem}>
                <FeedStockCard
                  enabled={feedEnabled}
                  items={feedQuery.data?.items}
                  isPending={feedQuery.isPending}
                  error={
                    feedQuery.error instanceof Error
                      ? getUserFacingError(feedQuery.error, t)
                      : null
                  }
                  locale={locale}
                  title={t("producer.dashboard.feedTitle")}
                  disabledHint={t("producer.dashboard.feedDisabled")}
                  onPress={() =>
                    navigation.navigate("FarmFeedStock", { farmId, farmName })
                  }
                />
              </View>
            </View>
            {(cheptelOverviewQ.data?.categoryBreakdown?.length ?? 0) > 0 ? (
              <ScreenSection title={t("cheptel.categoryBreakdown")}>
                <CategoryBreakdownPanel
                  rows={cheptelOverviewQ.data?.categoryBreakdown ?? []}
                />
              </ScreenSection>
            ) : null}
            {accessToken ? (
              <FarmDashboardAISection
                farmId={farmId}
                accessToken={accessToken}
                activeProfileId={activeProfileId}
                predictionTitle={t("predictions.sectionDashboard")}
              />
            ) : null}
          </>
          )}
        </ScrollView>
      </MobileAppShell>
      <ProducerProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
}

function CardShell({
  emoji,
  title,
  children,
  onPress,
  disabled
}: {
  emoji: string;
  title: string;
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {children}
    </Pressable>
  );
}

function GestationsCard({
  items,
  isPending,
  error,
  locale,
  title,
  dayAbbr,
  urgentLabel,
  onPress
}: {
  items: DashboardGestationItemDto[] | undefined;
  isPending: boolean;
  error: string | null;
  locale: string;
  title: string;
  dayAbbr: string;
  urgentLabel: string;
  onPress: () => void;
}) {
  if (isPending && !items) {
    return (
      <CardShell emoji="🐷" title={title} onPress={onPress}>
        <CardContentSkeleton lines={3} />
      </CardShell>
    );
  }
  if (error) {
    return (
      <CardShell emoji="🐷" title={title} onPress={onPress}>
        <Text style={styles.errSmall}>{error}</Text>
      </CardShell>
    );
  }
  const list = items ?? [];
  if (list.length === 0) {
    return (
      <CardShell emoji="🐷" title={title} onPress={onPress}>
        <Text style={styles.muted}>—</Text>
      </CardShell>
    );
  }
  return (
    <CardShell emoji="🐷" title={title} onPress={onPress}>
      <View style={styles.gestList}>
        {list.slice(0, 4).map((it) => (
          <View key={it.animalId} style={styles.gestRow}>
            <View style={styles.gestMain}>
              <Text style={styles.gestName} numberOfLines={1}>
                {it.label}
              </Text>
              <Text style={styles.gestMeta}>
                {formatDay(it.expectedFarrowingAt, locale)} · {it.daysRemaining}{" "}
                {dayAbbr}
              </Text>
            </View>
            {it.urgent ? (
              <View style={styles.badgeUrgent}>
                <Text style={styles.badgeUrgentText} numberOfLines={1}>
                  {urgentLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </CardShell>
  );
}

function HealthCard({
  data,
  isPending,
  error,
  locale,
  title,
  labels,
  dayAbbr,
  onPress
}: {
  data: DashboardHealthDto | undefined;
  isPending: boolean;
  error: string | null;
  locale: string;
  title: string;
  labels: {
    vaccines: string;
    vet: string;
    diseases: string;
    mortality: string;
  };
  dayAbbr: string;
  onPress: () => void;
}) {
  if (isPending && !data) {
    return (
      <CardShell emoji="🏥" title={title} onPress={onPress}>
        <CardContentSkeleton lines={3} />
      </CardShell>
    );
  }
  if (error) {
    return (
      <CardShell emoji="🏥" title={title} onPress={onPress}>
        <Text style={styles.errSmall}>{error}</Text>
      </CardShell>
    );
  }
  const v0 = data?.upcomingVaccines?.[0];
  const vaccineLine = v0
    ? `${formatDay(v0.dueAt, locale)} · ${v0.title}${v0.animalHint ? ` (${v0.animalHint})` : ""}`
    : "—";
  const vet = data?.nextVetConsultation;
  const vetLine = vet
    ? `${formatDay(vet.openedAt, locale)} · ${vet.subject}`
    : "—";
  const dis = data?.activeDiseaseCases;
  const disLine =
    dis && dis.count > 0
      ? dis.byType.length > 0
        ? `${dis.count} · ${dis.byType.map((b) => `${b.title} (${b.count})`).join(", ")}`
        : `${dis.count}`
      : "0";
  const mort =
    data?.mortalityRate30d != null
      ? `${(Number(data.mortalityRate30d) * 100).toLocaleString(locale, { maximumFractionDigits: 2 })} % (${data.mortalityWindowDays} ${dayAbbr})`
      : "—";

  return (
    <CardShell emoji="🏥" title={title} onPress={onPress}>
      <View style={styles.healthBlock}>
        <Text style={styles.healthLabel}>💉 {labels.vaccines}</Text>
        <Text style={styles.healthValue} numberOfLines={3}>
          {vaccineLine}
        </Text>
      </View>
      <View style={styles.healthBlock}>
        <Text style={styles.healthLabel}>🩺 {labels.vet}</Text>
        <Text style={styles.healthValue} numberOfLines={2}>
          {vetLine}
        </Text>
      </View>
      <View style={styles.healthBlock}>
        <Text style={styles.healthLabel}>🤒 {labels.diseases}</Text>
        <Text style={styles.healthValue} numberOfLines={2}>
          {disLine}
        </Text>
      </View>
      <View style={styles.healthBlock}>
        <Text style={styles.healthLabel}>💀 {labels.mortality}</Text>
        <Text style={styles.healthValue} numberOfLines={2}>
          {mort}
        </Text>
      </View>
    </CardShell>
  );
}

function FeedStockCard({
  enabled,
  items,
  isPending,
  error,
  locale,
  title,
  disabledHint,
  onPress
}: {
  enabled: boolean;
  items: DashboardFeedStockItemDto[] | undefined;
  isPending: boolean;
  error: string | null;
  locale: string;
  title: string;
  disabledHint: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  if (!enabled) {
    return (
      <CardShell emoji="🌾" title={title} onPress={onPress} disabled>
        <Text style={styles.muted}>{disabledHint}</Text>
      </CardShell>
    );
  }
  if (isPending && !items) {
    return (
      <CardShell emoji="🌾" title={title} onPress={onPress}>
        <CardContentSkeleton lines={3} />
      </CardShell>
    );
  }
  if (error) {
    return (
      <CardShell emoji="🌾" title={title} onPress={onPress}>
        <Text style={styles.errSmall}>{error}</Text>
      </CardShell>
    );
  }
  const list = (items ?? []).filter(dashboardFeedItemEligibleForGauge);
  if (list.length === 0) {
    return (
      <CardShell emoji="🌾" title={title} onPress={onPress}>
        <Text style={styles.muted}>—</Text>
      </CardShell>
    );
  }
  return (
    <CardShell emoji="🌾" title={title} onPress={onPress}>
      <View style={styles.feedGaugeList}>
        {list.slice(0, 4).map((it, index) => {
          const gauge = dashboardFeedItemToGauge(it, index, t, locale);
          return (
            <FeedStockLevelGauge
              key={gauge.key}
              name={gauge.name}
              subtitle={gauge.subtitle}
              displayValue={gauge.displayValue}
              percent={gauge.percent}
              gaugeColor={gauge.gaugeColor}
              dotColor={gauge.dotColor}
              daysLabel={gauge.daysLabel}
              variant="embedded"
            />
          );
        })}
      </View>
    </CardShell>
  );
}

const styles = StyleSheet.create({
  heroBar: {
    flexDirection: "column",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  heroWelcomeCluster: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  heroTopRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: mobileSpacing.sm
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  heroIconBtn: {
    padding: mobileSpacing.sm,
    borderRadius: mobileRadius.pill
  },
  heroIconBtnPressed: {
    opacity: 0.85
  },
  heroSettingsBtn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.background
  },
  heroSettingsBtnPressed: {
    opacity: 0.85,
    backgroundColor: mobileColors.accentSoft
  },
  heroSettingsTx: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent
  },
  wrap: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.lg
  },
  heroRentability: {
    width: "100%"
  },
  grid: {
    flexDirection: "column",
    gap: mobileSpacing.md
  },
  gridItem: {
    width: "100%",
    alignSelf: "stretch",
    flexShrink: 0
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    minHeight: 120,
    ...mobileShadows.card
  },
  cardDisabled: {
    opacity: 0.55
  },
  cardPressed: {
    opacity: 0.92
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  cardEmoji: {
    fontSize: 22
  },
  cardTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    flex: 1
  },
  muted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  errSmall: {
    ...mobileTypography.meta,
    color: mobileColors.error
  },
  gestList: { gap: mobileSpacing.sm },
  gestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  gestMain: { flex: 1 },
  gestName: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontSize: 14
  },
  gestMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  badgeUrgent: {
    backgroundColor: mobileColors.error,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    height: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeUrgentText: {
    color: mobileColors.onAccent,
    fontSize: 10,
    fontWeight: "800"
  },
  healthBlock: { marginBottom: mobileSpacing.sm },
  healthLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 2
  },
  healthValue: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontSize: 13
  },
  feedList: { gap: mobileSpacing.md },
  feedGaugeList: { gap: mobileSpacing.xs },
  emptyFarm: {
    padding: mobileSpacing.lg,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  emptyTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  emptyBody: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  linkBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.accentSoft
  },
  linkBtnText: {
    ...mobileTypography.body,
    color: mobileColors.success,
    fontWeight: "600"
  },
  // producerScoreCard et styles associés supprimés — remplacés par MeteoProfilCard
});
