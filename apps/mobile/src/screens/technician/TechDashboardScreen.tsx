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
import { DashboardTaskWidget } from "../../components/tasks";
import { TechQuickActionModals } from "../../components/technician/TechQuickActionModals";
import { useTechBottomChromePad } from "../../context/TechBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import {
  fetchTechnicianActivity,
  fetchTechnicianDashboard
} from "../../lib/api";
import {
  canTechQuickAction,
  type TechQuickActionKey
} from "../../lib/technicianPermissions";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors, techRadius, techShadow } from "../../theme/technicianTheme";
import type { RootStackParamList } from "../../types/navigation";

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
  a: { id: string; action: string; detail: string | null; createdAt: string; module: string },
  locale: string
): EventItem {
  const d = new Date(a.createdAt);
  const date = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return {
    id: a.id,
    title: a.action,
    subtitle: a.detail ?? a.module,
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
  const bottomPad = useTechBottomChromePad();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, clientFeatures } =
    useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<TechQuickActionKey | null>(null);

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

  const farms = dashQ.data?.farms ?? [];
  const resolvedFarmId = activeFarmId ?? dashQ.data?.activeFarmId ?? farms[0]?.farmId ?? null;
  const activeFarm = farms.find((f) => f.farmId === resolvedFarmId);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await Promise.all([dashQ.refetch(), activityQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, dashQ, activityQ]);

  useFocusEffect(
    useCallback(() => {
      void refreshAuthMe();
    }, [refreshAuthMe])
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

  const kpis = dashQ.data?.kpis;

  const dashboardHeader: ReactNode = (
    <View style={styles.heroBar}>
      <TechWelcomeHeader
        welcomeLabel={t("tech.dashboard.welcomeLine")}
        displayName={displayName}
        avatarUrl={resolveActiveProfileAvatarUrl(authMe, activeProfileId)}
        onPressAvatar={() => setProfileOpen(true)}
      />
      <Pressable
        onPress={() => {
          if (activeFarm) {
            navigation.navigate("SmartAlertsList", {
              farmId: activeFarm.farmId,
              farmName: activeFarm.farmName
            });
          }
        }}
        style={({ pressed }) => [styles.bell, pressed && { opacity: 0.85 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t("smartAlerts.bellA11y", "Notifications")}
      >
        <Ionicons name="notifications-outline" size={22} color={techColors.primary} />
        {(dashQ.data?.alertsCount ?? 0) > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{dashQ.data?.alertsCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );

  return (
    <TechMobileShell customHeader={dashboardHeader} omitBottomTabBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomPad + mobileSpacing.xl }
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.farmPills}>
              {farms.map((f) => {
                const active = f.farmId === resolvedFarmId;
                return (
                  <Pressable
                    key={f.farmId}
                    style={[styles.farmPill, active && styles.farmPillActive]}
                    onPress={() => setActiveFarmId(f.farmId)}
                  >
                    <Text style={[styles.farmPillText, active && styles.farmPillTextActive]}>
                      {f.farmName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </ProfileHeroCard>

        <View style={styles.sectionBlock}>
          <ScreenSection title={t("tech.dashboard.tasksToday")}>
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
                      Alert.alert("", t("tech.tasks.noFarm"));
                      return;
                    }
                    if (!allowed) {
                      Alert.alert("", t("tech.permissionDenied"));
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
          <ScreenSection title={t("tech.dashboard.recentActivity")}>
            {dashQ.isPending && !dashQ.data ? (
              <ListSkeleton count={4} />
            ) : events.length > 0 ? (
              <EventList data={events} />
            ) : (
              <ProfileSectionEmpty>{t("tech.dashboard.noActivity")}</ProfileSectionEmpty>
            )}
          </ScreenSection>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: techColors.canvas,
    gap: mobileSpacing.sm
  },
  sectionBlock: { gap: mobileSpacing.sm },
  subtitle: { ...mobileTypography.meta, color: techColors.textSecondary },
  bell: { padding: mobileSpacing.sm, position: "relative" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: techColors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  farmPills: { marginTop: mobileSpacing.xs },
  farmPill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: techRadius.pill,
    backgroundColor: techColors.primaryLight,
    borderWidth: 1,
    borderColor: techColors.border,
    marginRight: mobileSpacing.sm
  },
  farmPillActive: { backgroundColor: techColors.primary, borderColor: techColors.primary },
  farmPillText: { ...mobileTypography.meta, fontWeight: "600", color: techColors.textSecondary },
  farmPillTextActive: { color: "#fff" },
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
  kpiValue: { fontSize: 22, fontWeight: "700", color: techColors.primary },
  kpiLabel: { ...mobileTypography.meta, color: techColors.textSecondary, marginTop: 4 }
});
