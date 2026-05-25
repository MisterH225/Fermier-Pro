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
  TextInput,
  View
} from "react-native";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import { MobileAppShell } from "../../components/layout";
import { AlertBadge } from "../../components/smartAlerts/AlertBadge";
import { DashboardTaskWidget } from "../../components/tasks";
import { VetProfileModal } from "../../components/vet/VetProfileModal";
import { VetWelcomeHeader } from "../../components/vet/VetWelcomeHeader";
import { VisitCard } from "../../components/vet/VisitCard";
import { useVetBottomChromePad } from "../../context/VetBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import { fetchFarms, fetchVetDashboard } from "../../lib/api";
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
  const bottomPad = useVetBottomChromePad();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, clientFeatures } =
    useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<(typeof TASK_FILTERS)[number]>("today");

  const vetStatus = authMe?.vetProfessional?.verificationStatus;
  const isPending = vetStatus === "pending";
  const isVerified = vetStatus === "verified";

  const dashQ = useQuery({
    queryKey: ["vetDashboard", activeProfileId],
    queryFn: () => fetchVetDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && !isPending)
  });

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId, "vetDash"],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && !isPending)
  });

  const primaryFarm = farmsQ.data?.[0];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await Promise.all([dashQ.refetch(), farmsQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, dashQ, farmsQ]);

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

  const notificationCount =
    (dashQ.data?.kpis.healthAlerts ?? 0) + (dashQ.data?.kpis.pendingTasks ?? 0);

  const kpis = dashQ.data?.kpis;

  const dashboardHeader: ReactNode = (
    <View style={styles.heroBar}>
      <VetWelcomeHeader
        welcomeLabel={t("vet.dashboard.welcome")}
        displayName={displayName}
        avatarUrl={authMe?.user.avatarUrl ?? null}
        verified={isVerified}
        onPressAvatar={() => setProfileOpen(true)}
      />
      <Pressable
        onPress={() => {
          if (primaryFarm) {
            navigation.navigate("SmartAlertsList", {
              farmId: primaryFarm.id,
              farmName: primaryFarm.name
            });
            return;
          }
          navigation.navigate("VetFarms");
        }}
        style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.85 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t("smartAlerts.bellA11y", "Notifications")}
      >
        <View style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={22} color={vetColors.primary} />
          {notificationCount > 0 ? <AlertBadge count={notificationCount} /> : null}
        </View>
      </Pressable>
    </View>
  );

  return (
    <MobileAppShell customHeader={dashboardHeader} omitBottomTabBar>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        {isPending ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingTx}>⏳ {t("vet.dashboard.pendingBanner")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={20} color={vetColors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("vet.dashboard.searchPlaceholder")}
                placeholderTextColor={vetColors.textSecondary}
                value={search}
                onChangeText={setSearch}
              />
              <Ionicons name="options-outline" size={20} color={vetColors.textSecondary} />
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t("vet.dashboard.upcomingTitle")}</Text>
              <Pressable onPress={() => navigation.navigate("VetAgenda")}>
                <Text style={styles.sectionCta}>{t("vet.dashboard.seeAll")}</Text>
              </Pressable>
            </View>
            {(dashQ.data?.upcomingVisits.length ?? 0) === 0 ? (
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
                    onPress={() =>
                      navigation.navigate("VetConsultationDetail", {
                        farmId: v.farmId,
                        farmName: v.farmName,
                        consultationId: v.id
                      })
                    }
                    onMessage={() => navigation.navigate("VetMessages")}
                  />
                ))}
              </ScrollView>
            )}

            <Text style={[styles.sectionTitle, styles.sectionGap]}>
              {t("vet.dashboard.kpisTitle")}
            </Text>
            <View style={styles.kpiGrid}>
              <KpiTile
                label={t("vet.dashboard.kpiFarms")}
                value={kpis?.farmsFollowed ?? 0}
                emoji="🏡"
                bg={vetColors.primaryLight}
                accent={vetColors.primary}
              />
              <KpiTile
                label={t("vet.dashboard.kpiVisits")}
                value={kpis?.visitsThisMonth ?? 0}
                emoji="🩺"
                bg="#E8F5E9"
                accent="#2E7D32"
              />
              <KpiTile
                label={t("vet.dashboard.kpiAlerts")}
                value={kpis?.healthAlerts ?? 0}
                emoji="⚠️"
                bg="#FFF3E0"
                accent="#E65100"
              />
              <KpiTile
                label={t("vet.dashboard.kpiTasks")}
                value={kpis?.pendingTasks ?? 0}
                emoji="📋"
                bg="#FCE4EC"
                accent="#C2185B"
              />
            </View>

            {primaryFarm && clientFeatures.tasks && accessToken ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>{t("vet.dashboard.tasksTitle")}</Text>
                  <Pressable onPress={() => navigation.navigate("VetTasks")}>
                    <Text style={styles.sectionCta}>{t("vet.dashboard.seeAll")}</Text>
                  </Pressable>
                </View>
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
                  farmId={primaryFarm.id}
                  farmName={primaryFarm.name}
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
            <EventList
              data={events}
              layout="embedded"
              emptyMessage={t("vet.dashboard.activityEmpty")}
            />

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
      <VetProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </MobileAppShell>
  );
}

function KpiTile({
  label,
  value,
  emoji,
  bg,
  accent
}: {
  label: string;
  value: number;
  emoji: string;
  bg: string;
  accent: string;
}) {
  return (
    <View style={[styles.kpiTile, { backgroundColor: bg }, vetShadow.card]}>
      <Text style={styles.kpiEmoji}>{emoji}</Text>
      <Text style={[styles.kpiVal, { color: accent }]}>{value}</Text>
      <Text style={styles.kpiLbl}>{label}</Text>
    </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: vetColors.border,
    backgroundColor: vetColors.cardBg,
    gap: mobileSpacing.sm
  },
  heroIconBtn: {
    padding: mobileSpacing.sm,
    borderRadius: vetRadius.pill
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
    backgroundColor: "#FEF3C7",
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: 1,
    borderColor: "#F59E0B"
  },
  pendingTx: { color: "#92400E", fontWeight: "600", textAlign: "center" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: vetRadius.button,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    gap: mobileSpacing.sm
  },
  searchInput: { flex: 1, fontSize: 15, color: vetColors.textPrimary },
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
    borderWidth: 1,
    borderColor: vetColors.border
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
  pillTxActive: { color: "#fff" },
  quickActions: { gap: mobileSpacing.sm },
  quickBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center"
  },
  quickBtnPrimary: { backgroundColor: vetColors.primary },
  quickBtnOutline: {
    borderWidth: 1.5,
    borderColor: vetColors.primary,
    backgroundColor: "transparent"
  },
  quickBtnTx: { fontWeight: "700", color: vetColors.primary, fontSize: 15 },
  quickBtnTxPrimary: { color: "#fff" }
});
