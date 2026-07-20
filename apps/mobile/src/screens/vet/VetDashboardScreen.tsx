import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { KpiTile, vetPalette } from "../../components/common";
import { CardContentSkeleton, KpiGridSkeleton, ListSkeleton } from "../../components/common/SkeletonBlocks";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import { VetMobileShell } from "../../components/layout";
import { DashboardTaskWidget } from "../../components/tasks";
import { VetWelcomeHeader } from "../../components/vet/VetWelcomeHeader";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { NotificationsHeaderButton } from "../../components/notifications/NotificationsHeaderButton";
import { ShopOrdersTrackingCard } from "../../components/notifications/ShopOrdersTrackingCard";
import { SupportHeaderButton } from "../../components/support/SupportHeaderButton";
import { VisitCard } from "../../components/vet/VisitCard";
import { PendingInvitationsBanner } from "../../components/collaboration/PendingInvitationsBanner";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useVetFarms } from "../../hooks/useVetFarms";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { useSession } from "../../context/SessionContext";
import { fetchVetDashboard, fetchVetAppointmentFinanceSummary } from "../../lib/api";
import { welcomeFirstName } from "../../lib/userDisplay";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const TASK_FILTERS = ["today", "week", "all"] as const;

function activityToEvent(
  a: {
    id: string;
    kind: string;
    title: string;
    subtitle: string;
    occurredAt: string;
  },
  locale: string
): EventItem {
  const iconMap: Record<string, string> = {
    consultation: "medkit-outline",
    vet_visit: "walk-outline",
    vaccination: "shield-checkmark-outline",
    disease: "warning-outline",
    treatment: "bandage-outline",
    alert: "alert-circle-outline"
  };
  const d = new Date(a.occurredAt);
  const date = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return {
    id: a.id,
    title: a.title,
    subtitle: a.subtitle,
    date,
    valueType: "neutral",
    iconType: "custom",
    customIcon: iconMap[a.kind] ?? "pulse-outline",
    iconColor: vetColors.primary
  };
}

export function VetDashboardScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, clientFeatures } =
    useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [taskFilter, setTaskFilter] = useState<(typeof TASK_FILTERS)[number]>("today");

  const vetStatus = authMe?.vetProfessional?.verificationStatus;
  const isPending = vetStatus === "pending";
  const isVerified = vetStatus === "verified";

  const dashQ = useQuery({
    queryKey: ["vetDashboard", activeProfileId],
    queryFn: () => fetchVetDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && !isPending)
  });

  const financeQ = useQuery({
    queryKey: ["vetAppointmentFinance", activeProfileId, "vet"],
    queryFn: () =>
      fetchVetAppointmentFinanceSummary(accessToken!, "vet", activeProfileId),
    enabled: Boolean(accessToken && !isPending)
  });

  const {
    farms: assignedFarms,
    selectedFarm,
    setSelectedFarmId
  } = useVetFarms(isPending ? null : activeProfileId);

  /** 1 élevage → notifications scopées ; plusieurs → globales (sans farmId). */
  const notificationsFarmId =
    assignedFarms.length === 1 ? selectedFarm?.id : undefined;
  const notificationsFarmName =
    assignedFarms.length === 1 ? selectedFarm?.name : undefined;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await dashQ.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, dashQ]);

  useFocusEffect(
    useCallback(() => {
      void refreshAuthMe();
    }, [refreshAuthMe])
  );

  const displayName = useMemo(() => {
    const fn = welcomeFirstName(authMe?.user ?? null);
    return fn ? `Dr. ${fn}` : t("vet.dashboard.defaultName");
  }, [authMe, t]);

  const events = useMemo(
    () => (dashQ.data?.recentActivity ?? []).map((a) => activityToEvent(a, locale)),
    [dashQ.data?.recentActivity, locale]
  );

  const kpis = dashQ.data?.kpis;

  const dashboardHeader: ReactNode = (
    <View style={styles.heroBar}>
      <View style={styles.heroHeaderRow}>
        <VetWelcomeHeader
          welcomeLabel={t("vet.dashboard.welcome")}
          displayName={displayName}
          avatarUrl={resolveActiveProfileAvatarUrl(authMe, activeProfileId)}
          verified={isVerified}
          onPressAvatar={() => navigation.navigate("VetAccount")}
        />
        <View style={styles.heroActions}>
          <SupportHeaderButton
            iconColor={vetColors.primary}
            style={[styles.heroIconBtn, vetShadow.soft]}
          />
          <NotificationsHeaderButton
            iconColor={vetColors.primary}
            farmId={notificationsFarmId}
            farmName={notificationsFarmName}
            style={[styles.heroIconBtn, vetShadow.soft]}
          />
          <Pressable
            onPress={() => navigation.navigate("VetAccount")}
            style={({ pressed }) => [
              styles.heroIconBtn,
              vetShadow.soft,
              pressed && styles.heroIconBtnPressed
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("vet.account.title")}
            testID="vet-settings-button"
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={vetColors.primary}
            />
          </Pressable>
        </View>
      </View>
      {accessToken && !isPending ? <WalletDashboardCard variant="vet" /> : null}
    </View>
  );

  return (
    <VetMobileShell customHeader={dashboardHeader} omitBottomTabBar>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <PendingInvitationsBanner />
        <ShopOrdersTrackingCard
          accentColor={vetColors.primary}
          backgroundColor={vetColors.primaryLight}
        />
        {isPending ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingTx}>⏳ {t("vet.dashboard.pendingBanner")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t("vet.dashboard.upcomingTitle")}</Text>
              <Pressable onPress={() => navigation.navigate("VetAgenda")}>
                <Text style={styles.sectionCta}>{t("vet.dashboard.seeAll")}</Text>
              </Pressable>
            </View>
            {dashQ.isPending && !dashQ.data ? (
              <CardContentSkeleton lines={2} />
            ) : (dashQ.data?.upcomingVisits.length ?? 0) === 0 ? (
              <Pressable
                style={styles.emptyCard}
                onPress={() => navigation.navigate("VetFarms")}
              >
                <Text style={styles.emptyTx}>{t("vet.dashboard.noVisits")}</Text>
              </Pressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(dashQ.data?.upcomingVisits ?? []).map((v) => (
                  <VisitCard
                    key={v.id}
                    farmName={v.farmName}
                    producerName={v.producerName}
                    producerPhone={v.producerPhone}
                    scheduledAt={v.scheduledAt}
                    subject={v.subject}
                    location={v.location}
                    conflictLabel={v.conflictLabel}
                    statusLabel={
                      v.kind === "appointment" && v.status === "APPOINTMENT_REQUESTED"
                        ? t("vet.appointment.requestPending")
                        : undefined
                    }
                    onPress={() => {
                      if (v.kind === "appointment") {
                        navigation.navigate("VetAppointmentDetail", {
                          appointmentId: v.id
                        });
                        return;
                      }
                      navigation.navigate("VetConsultationDetail", {
                        farmId: v.farmId,
                        farmName: v.farmName,
                        consultationId: v.id
                      });
                    }}
                    onMessage={() => navigation.navigate("VetMessages")}
                  />
                ))}
              </ScrollView>
            )}

            <Text style={[styles.sectionTitle, styles.sectionGap]}>
              {t("vet.dashboard.kpisTitle")}
            </Text>
            {dashQ.isPending && !dashQ.data ? (
              <KpiGridSkeleton count={4} />
            ) : (
            <View style={styles.kpiGrid}>
              <KpiTile
                label={t("vet.dashboard.kpiFarms")}
                value={kpis?.farmsFollowed ?? 0}
                emoji="🏡"
                bg={vetColors.kpiBlue}
                accent={vetColors.primary}
                palette={vetPalette}
              />
              <KpiTile
                label={t("vet.dashboard.kpiVisits")}
                value={kpis?.visitsThisMonth ?? 0}
                emoji="🩺"
                bg={vetColors.kpiGreen}
                accent={vetColors.success}
                palette={vetPalette}
              />
              <KpiTile
                label={t("vet.dashboard.kpiAlerts")}
                value={kpis?.healthAlerts ?? 0}
                emoji="⚠️"
                bg={vetColors.kpiAmber}
                accent={vetColors.warning}
                palette={vetPalette}
              />
              <KpiTile
                label={t("vet.dashboard.kpiTasks")}
                value={kpis?.pendingTasks ?? 0}
                emoji="📋"
                bg={vetColors.kpiRose}
                accent={vetColors.danger}
                palette={vetPalette}
              />
            </View>
            )}

            {(financeQ.data?.pendingEarnings ?? 0) > 0 ? (
              <View style={styles.earningsCard}>
                <Text style={styles.earningsLabel}>
                  {t("vet.dashboard.pendingEarnings")}
                </Text>
                <Text style={styles.earningsValue}>
                  {Math.round(financeQ.data!.pendingEarnings).toLocaleString("fr-FR")}{" "}
                  {financeQ.data!.currency}
                </Text>
              </View>
            ) : null}

            {selectedFarm && clientFeatures.tasks && accessToken ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>{t("vet.dashboard.tasksTitle")}</Text>
                  <Pressable
                    onPress={() =>
                      navigation.navigate("VetFarmDetail", {
                        farmId: selectedFarm.id,
                        farmName: selectedFarm.name,
                        initialTab: "health"
                      })
                    }
                  >
                    <Text style={styles.sectionCta}>{t("vet.dashboard.seeAll")}</Text>
                  </Pressable>
                </View>
                {assignedFarms.length > 1 ? (
                  <View style={styles.pills}>
                    {assignedFarms.map((f) => (
                      <Pressable
                        key={f.id}
                        style={[
                          styles.pill,
                          selectedFarm.id === f.id && styles.pillActive
                        ]}
                        onPress={() => setSelectedFarmId(f.id)}
                      >
                        <Text
                          style={[
                            styles.pillTx,
                            selectedFarm.id === f.id && styles.pillTxActive
                          ]}
                          numberOfLines={1}
                        >
                          {f.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.pills}>
                  {TASK_FILTERS.map((f) => (
                    <Pressable
                      key={f}
                      style={[styles.pill, taskFilter === f && styles.pillActive]}
                      onPress={() => setTaskFilter(f)}
                    >
                      <Text
                        style={[
                          styles.pillTx,
                          taskFilter === f && styles.pillTxActive
                        ]}
                      >
                        {t(`vet.dashboard.taskFilter.${f}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <DashboardTaskWidget
                  farmId={selectedFarm.id}
                  farmName={selectedFarm.name}
                  accessToken={accessToken}
                  activeProfileId={activeProfileId}
                  embedded
                  period={taskFilter}
                />
              </>
            ) : null}

            <Text style={[styles.sectionTitle, styles.sectionGap]}>
              {t("vet.dashboard.activityTitle")}
            </Text>
            {dashQ.isPending && !dashQ.data ? (
              <ListSkeleton count={3} />
            ) : (
            <EventList
              data={events}
              layout="embedded"
              emptyMessage={t("vet.dashboard.activityEmpty")}
            />
            )}

            <Text style={[styles.sectionTitle, styles.sectionGap]}>
              {t("vet.dashboard.quickActions")}
            </Text>
            <View style={styles.quickActions}>
              <QuickBtn
                label={t("vet.dashboard.actionFarms")}
                primary
                onPress={() => navigation.navigate("VetFarms")}
              />
              <QuickBtn
                label={t("vet.dashboard.actionSchedule")}
                onPress={() => navigation.navigate("VetAgenda")}
              />
              <QuickBtn
                label={t("vet.dashboard.actionCase")}
                onPress={() => navigation.navigate("VetFarms")}
              />
            </View>
          </>
        )}
      </ScrollView>
    </VetMobileShell>
  );
}

function QuickBtn({
  label,
  primary,
  onPress
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.quickBtn,
        primary ? styles.quickBtnPrimary : styles.quickBtnOutline
      ]}
    >
      <Text style={[styles.quickBtnTx, primary && styles.quickBtnTxPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroBar: {
    flexDirection: "column",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    backgroundColor: vetColors.canvas
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  heroIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: vetColors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  heroIconBtnPressed: {
    opacity: 0.85
  },
  bellWrap: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center"
  },
  wrap: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  pendingBanner: {
    backgroundColor: vetColors.kpiAmber,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  pendingTx: {
    color: vetColors.textPrimary,
    fontWeight: "600",
    textAlign: "center"
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  sectionTitle: {
    ...mobileTypography.title,
    fontSize: 17,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  sectionGap: { marginTop: mobileSpacing.md },
  sectionCta: { color: vetColors.primary, fontWeight: "600", fontSize: 14 },
  emptyCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.xl,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    ...vetShadow.card
  },
  emptyTx: { color: vetColors.textSecondary },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  kpiTile: {
    width: "48%",
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    minHeight: 100
  },
  kpiEmoji: { fontSize: 22, marginBottom: 4 },
  kpiVal: { fontSize: 26, fontWeight: "800" },
  kpiLbl: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    marginTop: 2
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: vetColors.cardBg,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  pillActive: { backgroundColor: vetColors.primary, borderColor: vetColors.primary },
  pillTx: { fontSize: 13, color: vetColors.textSecondary, fontWeight: "600" },
  pillTxActive: { color: vetColors.onPrimary },
  quickActions: { gap: mobileSpacing.sm },
  quickBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center"
  },
  quickBtnPrimary: {
    backgroundColor: vetColors.primary,
    ...vetShadow.soft
  },
  quickBtnOutline: {
    borderWidth: 1.5,
    borderColor: vetColors.primary,
    backgroundColor: vetColors.cardBg
  },
  quickBtnTx: { fontWeight: "700", color: vetColors.primary, fontSize: 15 },
  quickBtnTxPrimary: { color: vetColors.onPrimary },
  earningsCard: {
    marginTop: mobileSpacing.md,
    backgroundColor: vetColors.kpiGreen,
    borderRadius: 12,
    padding: mobileSpacing.lg,
    gap: 4
  },
  earningsLabel: {
    ...mobileTypography.meta,
    color: vetColors.success,
    fontWeight: "600"
  },
  earningsValue: {
    ...mobileTypography.title,
    fontSize: 22,
    fontWeight: "800",
    color: vetColors.success
  }
});
