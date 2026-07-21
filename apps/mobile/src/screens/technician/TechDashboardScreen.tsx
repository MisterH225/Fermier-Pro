import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { KpiGridSkeleton, ListSkeleton } from "../../components/common/SkeletonBlocks";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import {
  ProfileHeroCard,
  ProfileSectionEmpty,
  ProfileSectionLink,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { TechMobileShell } from "../../components/layout/TechMobileShell";
import { TechProfileModal } from "../../components/technician/TechProfileModal";
import { TechWelcomeHeader } from "../../components/technician/TechWelcomeHeader";
import { WalletDashboardCard } from "../../components/wallet/WalletDashboardCard";
import { NotificationsHeaderButton } from "../../components/notifications/NotificationsHeaderButton";
import { ShopOrdersTrackingCard } from "../../components/notifications/ShopOrdersTrackingCard";
import { SupportHeaderButton } from "../../components/support/SupportHeaderButton";
import { DashboardTaskWidget } from "../../components/tasks";
import { TechQuickActionModals } from "../../components/technician/TechQuickActionModals";
import { ActivityToggleHeader } from "../../components/collaboration/ActivityToggleHeader";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  resolveTechActiveFarm,
  useTechActiveFarm
} from "../../context/TechActiveFarmContext";
import {
  fetchTechnicianActivity,
  fetchTechnicianDashboard,
  fetchTechnicianProfile,
  type TechnicianActivityRowDto
} from "../../lib/api";
import {
  formatActivityAction,
  formatActivityDetail
} from "../../lib/formatActivityDetail";
import {
  canTechQuickAction,
  type TechQuickActionKey
} from "../../lib/technicianPermissions";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography, mobileColors, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import { techColors, techRadius, techShadow } from "../../theme/technicianTheme";
import type { RootStackParamList } from "../../types/navigation";
import { TechFarmSelector } from "../../components/technician/TechFarmSelector";

const QUICK_ACTIONS: {
  key: TechQuickActionKey;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "stock", icon: "nutrition-outline" },
  { key: "weight", icon: "scale-outline" },
  { key: "vaccine", icon: "medkit-outline" },
  { key: "disease", icon: "warning-outline" },
  { key: "mortality", icon: "skull-outline" },
  { key: "feedIn", icon: "cube-outline" }
];

function activityToEvent(
  a: TechnicianActivityRowDto,
  locale: string
): EventItem {
  const d = new Date(a.createdAt);
  const date = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const detailLabel = formatActivityDetail(a.detail, a.module);
  const subtitleParts = [a.farmName, detailLabel].filter(
    (part, index, arr) => Boolean(part) && arr.indexOf(part) === index
  );
  return {
    id: a.id,
    title: formatActivityAction(a.action),
    subtitle: subtitleParts.join(" · "),
    date,
    valueType: "neutral",
    iconType: "custom",
    customIcon: "pulse-outline",
    iconColor: techColors.primary
  };
}

export function TechDashboardScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, clientFeatures } =
    useSession();
  const { activeFarmId, setActiveFarmId } = useTechActiveFarm();
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [quickAction, setQuickAction] = useState<TechQuickActionKey | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const dashQ = useQuery({
    queryKey: ["techDashboard", activeProfileId, activeFarmId],
    queryFn: () =>
      fetchTechnicianDashboard(accessToken!, activeProfileId, activeFarmId ?? undefined),
    enabled: Boolean(accessToken)
  });

  const activityQ = useQuery({
    queryKey: ["techActivity", activeProfileId, activeFarmId],
    queryFn: () =>
      fetchTechnicianActivity(accessToken!, activeProfileId, activeFarmId ?? undefined, 5),
    enabled: Boolean(accessToken && dashQ.data?.activeFarmId)
  });

  const techProfileQ = useQuery({
    queryKey: ["techProfile", activeProfileId],
    queryFn: () => fetchTechnicianProfile(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const farms = dashQ.data?.farms ?? [];
  const activeFarm = resolveTechActiveFarm(
    farms,
    activeFarmId,
    dashQ.data?.activeFarmId
  );
  const resolvedFarmId = activeFarm?.farmId ?? null;

  const avatarUrl = useMemo(
    () =>
      techProfileQ.data?.profilePhotoUrl ??
      resolveActiveProfileAvatarUrl(authMe, activeProfileId),
    [techProfileQ.data?.profilePhotoUrl, authMe, activeProfileId]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await Promise.all([
        dashQ.refetch(),
        activityQ.refetch(),
        techProfileQ.refetch()
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, dashQ, activityQ, techProfileQ]);

  useFocusEffect(
    useCallback(() => {
      void refreshAuthMe();
      void techProfileQ.refetch();
    }, [refreshAuthMe, techProfileQ])
  );

  const displayName = welcomeFirstName(authMe?.user ?? null) ?? t("tech.dashboard.defaultName");
  const todayLabel = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const events = useMemo(
    () => (activityQ.data ?? []).map((a) => activityToEvent(a, locale)),
    [activityQ.data, locale]
  );
  const ACTIVITY_COLLAPSED = 3;
  const visibleEvents = useMemo(
    () =>
      activityExpanded ? events : events.slice(0, ACTIVITY_COLLAPSED),
    [activityExpanded, events]
  );

  const kpis = dashQ.data?.kpis;

  const dashboardHeader: ReactNode = (
    <View style={styles.heroBar}>
      <View style={styles.heroHeaderRow}>
        <TechWelcomeHeader
          welcomeLabel={t("tech.dashboard.welcomeLine")}
          displayName={displayName}
          avatarUrl={avatarUrl}
          onPressAvatar={() => setProfileOpen(true)}
        />
        <View style={styles.heroActions}>
          <SupportHeaderButton
            iconColor={techColors.primary}
            style={styles.heroIconBtn}
          />
          <NotificationsHeaderButton
            iconColor={techColors.primary}
            farmId={activeFarm?.farmId}
            farmName={activeFarm?.farmName}
            style={styles.heroIconBtn}
          />
          <Pressable
            onPress={() => navigation.navigate("ProducerFarmSettings")}
            style={({ pressed }) => [
              styles.heroIconBtn,
              pressed && styles.heroIconBtnPressed
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("settings.title")}
            testID="tech-settings-button"
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={techColors.primary}
            />
          </Pressable>
        </View>
      </View>
      {accessToken ? <WalletDashboardCard variant="tech" /> : null}
    </View>
  );

  return (
    <TechMobileShell customHeader={dashboardHeader} omitBottomTabBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomInset }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={techColors.primary}
          />
        }
      >
        <ProfileHeroCard>
          <Text style={styles.subtitle} numberOfLines={2}>
            {activeFarm
              ? t("tech.dashboard.farmSubtitle", {
                  farm: activeFarm.farmName,
                  date: todayLabel
                })
              : t("tech.dashboard.noFarm")}
          </Text>

          {farms.length > 1 ? (
            <TechFarmSelector
              farms={farms}
              selectedFarmId={resolvedFarmId}
              onSelect={setActiveFarmId}
            />
          ) : null}
        </ProfileHeroCard>

        <ShopOrdersTrackingCard
          accentColor={techColors.primary}
          backgroundColor={techColors.primaryLight}
        />

        <View style={styles.sectionBlock}>
          <ScreenSection title={t("tech.dashboard.tasksToday")} plain>
            {activeFarm && clientFeatures.tasks && accessToken ? (
              <DashboardTaskWidget
                farmId={activeFarm.farmId}
                farmName={activeFarm.farmName}
                accessToken={accessToken}
                activeProfileId={activeProfileId}
                embedded
              />
            ) : (
              <ProfileSectionEmpty>{t("tech.dashboard.noTasks")}</ProfileSectionEmpty>
            )}
          </ScreenSection>
          <ProfileSectionLink
            color={techColors.primary}
            label={t("tech.dashboard.allTasks")}
            onPress={() => navigation.navigate("TechTasks")}
          />
        </View>

        <ScreenSection title={t("tech.dashboard.quickActions")} plain>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((a) => {
              const allowed = activeFarm
                ? canTechQuickAction(activeFarm.scopes, a.key)
                : false;
              return (
                <Pressable
                  key={a.key}
                  style={[
                    styles.quickCard,
                    techShadow.card,
                    !allowed && styles.quickCardDisabled
                  ]}
                  onPress={() => {
                    if (!activeFarm) {
                      Alert.alert(t("common.infoTitle"), t("tech.tasks.noFarm"));
                      return;
                    }
                    if (!allowed) {
                      Alert.alert(t("common.accessDeniedTitle"), t("tech.permissionDenied"));
                      return;
                    }
                    if (a.key === "vaccine") {
                      setQuickAction("vaccine");
                      return;
                    }
                    if (a.key === "mortality") {
                      navigation.navigate("FarmHealth", {
                        farmId: activeFarm.farmId,
                        farmName: activeFarm.farmName,
                        initialTab: "mortality",
                        openFormKind: "mortality"
                      });
                      return;
                    }
                    setQuickAction(a.key);
                  }}
                >
                  <Ionicons
                    name={a.icon}
                    size={26}
                    color={allowed ? techColors.primary : techColors.textMuted}
                  />
                  <Text
                    style={[styles.quickLabel, !allowed && styles.quickLabelDisabled]}
                  >
                    {t(`tech.quick.${a.key}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScreenSection>

        <ScreenSection title={t("tech.dashboard.farmStatus")} plain>
          {dashQ.isPending && !dashQ.data ? (
            <KpiGridSkeleton count={4} />
          ) : (
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, techShadow.card]}>
              <Text style={styles.kpiValue}>{kpis?.activeAlerts ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("tech.kpi.alerts")}</Text>
            </View>
            <View style={[styles.kpiCard, techShadow.card]}>
              <Text style={styles.kpiValue}>{kpis?.overdueVaccines ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("tech.kpi.vaccines")}</Text>
            </View>
            <View style={[styles.kpiCard, techShadow.card]}>
              <Text style={styles.kpiValue}>{kpis?.gestationThisWeek ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("tech.kpi.gestation")}</Text>
            </View>
            <View style={[styles.kpiCard, techShadow.card]}>
              <Text style={styles.kpiValue}>{kpis?.criticalStock ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("tech.kpi.stock")}</Text>
            </View>
          </View>
          )}
        </ScreenSection>

        <View style={styles.sectionBlock}>
          <ActivityToggleHeader
            title={t("tech.dashboard.recentActivity")}
            expanded={activityExpanded}
            onToggle={() => setActivityExpanded((v) => !v)}
          />
          {dashQ.isPending && !dashQ.data ? (
            <ListSkeleton count={3} />
          ) : events.length > 0 ? (
            <>
              <EventList
                data={visibleEvents}
                layout="embedded"
                emptyMessage={t("tech.dashboard.noActivity")}
              />
              {events.length > ACTIVITY_COLLAPSED ? (
                <Pressable
                  onPress={() => setActivityExpanded((v) => !v)}
                  style={styles.activityToggleMore}
                  accessibilityRole="button"
                >
                  <Text style={styles.activityToggleMoreTx}>
                    {activityExpanded
                      ? t("tech.dashboard.activityCollapse")
                      : t("tech.dashboard.activityExpand", {
                          count: events.length - ACTIVITY_COLLAPSED
                        })}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <ProfileSectionEmpty>{t("tech.dashboard.noActivity")}</ProfileSectionEmpty>
          )}
          <ProfileSectionLink
            color={techColors.primary}
            label={t("tech.dashboard.allActivity")}
            onPress={() => navigation.navigate("TechTracking")}
          />
        </View>
      </ScrollView>

      <TechQuickActionModals
        farm={
          activeFarm
            ? {
                farmId: activeFarm.farmId,
                farmName: activeFarm.farmName,
                scopes: activeFarm.scopes
              }
            : undefined
        }
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        openAction={quickAction}
        onClose={() => setQuickAction(null)}
        onSuccess={() => {
          void dashQ.refetch();
          void activityQ.refetch();
        }}
      />

      <TechProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </TechMobileShell>
  );
}

const styles = StyleSheet.create({
  heroBar: {
    flexDirection: "column",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    backgroundColor: techColors.canvas
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
    padding: mobileSpacing.sm,
    borderRadius: techRadius.pill
  },
  heroIconBtnPressed: {
    opacity: 0.85
  },
  sectionBlock: { gap: mobileSpacing.sm },
  subtitle: { ...mobileTypography.meta, color: techColors.textSecondary },
  bell: { padding: mobileSpacing.sm, position: "relative" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: techColors.danger,
    borderRadius: mobileRadius.md,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: mobileColors.background, fontSize: mobileFontSize.xs, fontWeight: "700" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  quickCard: {
    width: "31%",
    minWidth: 100,
    backgroundColor: techColors.cardBg,
    borderRadius: techRadius.card,
    padding: mobileSpacing.md,
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border
  },
  quickLabel: {
    ...mobileTypography.meta,
    textAlign: "center",
    color: techColors.textPrimary,
    fontWeight: "600"
  },
  quickCardDisabled: { opacity: 0.45 },
  quickLabelDisabled: { color: techColors.textMuted },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  kpiCard: {
    width: "47%",
    backgroundColor: techColors.cardBg,
    borderRadius: techRadius.card,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border
  },
  kpiValue: { fontSize: mobileFontSize.xl, fontWeight: "700", color: techColors.primary },
  kpiLabel: { ...mobileTypography.meta, color: techColors.textSecondary, marginTop: 4 },
  activityToggleMore: {
    alignSelf: "center",
    paddingVertical: mobileSpacing.sm
  },
  activityToggleMoreTx: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: techColors.primary
  }
});
