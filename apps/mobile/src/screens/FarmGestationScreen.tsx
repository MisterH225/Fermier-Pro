import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useCallback, type ReactNode } from "react";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ModuleAIInsights } from "../components/ai/ModuleAIInsights";
import { SmartChart, type SmartChartPeriod } from "../components/charts";
import { CreateGestationModal } from "../components/shared/CreateGestationModal";
import { GestationDetailModal } from "../components/gestation/GestationDetailModal";
import { MiseBasModal } from "../components/gestation/MiseBasModal";
import { FinanceKpiCard } from "../components/finance/FinanceKpiCard";
import { EventList, type EventItem } from "../components/lists";
import { ScreenSection } from "../components/layout/ScreenSection";
import { TabContent, TabSelector } from "../components/tabs";
import { useSession } from "../context/SessionContext";
import {
  fetchFarmAnimals,
  fetchGestationAvailableSows,
  fetchGestationHistory,
  fetchGestationOverview,
  fetchGestations,
  type GestationListItemDto
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FarmGestation">;

type TabId = "overview" | "active" | "planning" | "birth" | "history";

function urgencyEmoji(u?: string | null): string {
  if (u === "critical") return "🔴";
  if (u === "soon") return "🟡";
  return "🔵";
}

export function FarmGestationScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("overview");
  const [chartPeriod, setChartPeriod] = useState<SmartChartPeriod>("6M");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [histFilter, setHistFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [litterTarget, setLitterTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);

  useScreenTitle(navigation, t("navigation.extended.gestation"), {
    headerRight: () => (
      <Pressable
        onPress={() => setCreateOpen(true)}
        accessibilityLabel={t("gestationScreen.createTitle")}
        style={{ padding: 8 }}
      >
        <Ionicons name="add-circle-outline" size={26} color={mobileColors.accent} />
      </Pressable>
    )
  });

  const enabled = Boolean(accessToken);

  const overviewQ = useQuery({
    queryKey: ["gestation", farmId, "overview", activeProfileId],
    queryFn: () =>
      fetchGestationOverview(accessToken!, farmId, activeProfileId),
    enabled
  });

  const activeQ = useQuery({
    queryKey: [
      "gestation",
      farmId,
      "list",
      activeFilter,
      search,
      activeProfileId
    ],
    queryFn: () =>
      fetchGestations(accessToken!, farmId, activeProfileId, {
        status: "active",
        filter: activeFilter === "all" ? undefined : activeFilter,
        q: search.trim() || undefined
      }),
    enabled: enabled && (tab === "active" || tab === "birth")
  });

  const availableQ = useQuery({
    queryKey: ["gestation", farmId, "available", activeProfileId],
    queryFn: () =>
      fetchGestationAvailableSows(accessToken!, farmId, activeProfileId),
    enabled: enabled && tab === "planning"
  });

  const historyQ = useQuery({
    queryKey: ["gestation", farmId, "history", histFilter, activeProfileId],
    queryFn: () =>
      fetchGestationHistory(
        accessToken!,
        farmId,
        activeProfileId,
        histFilter === "all" ? undefined : histFilter
      ),
    enabled: enabled && tab === "history"
  });

  const animalsQ = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId),
    enabled: enabled && (createOpen || tab === "planning")
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["gestation", farmId] });
  }, [qc, farmId]);

  const females = useMemo(
    () =>
      (animalsQ.data ?? []).filter(
        (a) => a.sex === "female" && a.status === "active"
      ),
    [animalsQ.data]
  );
  const males = useMemo(
    () =>
      (animalsQ.data ?? []).filter(
        (a) => a.sex === "male" && a.status === "active"
      ),
    [animalsQ.data]
  );

  const chartLines = useMemo(() => {
    const months = overviewQ.data?.birthsPerMonth ?? [];
    return [
      {
        key: "births",
        label: t("gestationScreen.chartBirths"),
        color: mobileColors.accent,
        data: months.map((m) => ({ month: m.month, value: m.count }))
      }
    ];
  }, [overviewQ.data, t]);

  const activeEvents: EventItem[] = useMemo(() => {
    const items = activeQ.data?.items ?? [];
    let list = items;
    if (tab === "birth") {
      list = items.filter((g) => (g.progress?.daysRemaining ?? 99) <= 7);
    }
    return list.map((g) => gestationToEvent(g, t));
  }, [activeQ.data, tab, t]);

  const historyEvents: EventItem[] = useMemo(() => {
    const ev = historyQ.data?.events ?? [];
    return ev.map((e) => ({
      id: e.id,
      title: e.sowLabel,
      subtitle: t(`gestationScreen.eventTypes.${e.type}`, {
        defaultValue: e.type
      }),
      value: e.result ?? "—",
      valueType: "neutral" as const,
      date: e.date.slice(0, 10),
      iconType: "custom" as const,
      customIcon: "document-text-outline",
      meta: e
    }));
  }, [historyQ.data, t]);

  const refreshing =
    overviewQ.isFetching ||
    activeQ.isFetching ||
    availableQ.isFetching ||
    historyQ.isFetching;

  const onRefresh = () => {
    void overviewQ.refetch();
    void activeQ.refetch();
    void availableQ.refetch();
    void historyQ.refetch();
  };

  const kpis = overviewQ.data?.kpis;

  const tabScroll = (children: ReactNode) => (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <TabContent>{children}</TabContent>
    </ScrollView>
  );

  const overviewTab = (
    <>
      {overviewQ.isPending ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <>
          <ScreenSection plain>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("gestationScreen.kpiActive")}
                  value={String(kpis?.activeGestations ?? 0)}
                  deltaText={null}
                  variant="orange"
                />
              </View>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("gestationScreen.kpiDue7")}
                  value={String(kpis?.birthsDueIn7Days ?? 0)}
                  deltaText={null}
                  variant="blue"
                />
              </View>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("gestationScreen.kpiDueMonth")}
                  value={String(kpis?.birthsDueThisMonth ?? 0)}
                  deltaText={null}
                  variant="yellow"
                />
              </View>
              <View style={styles.kpiHalf}>
                <FinanceKpiCard
                  title={t("gestationScreen.kpiAvailable")}
                  value={String(kpis?.sowsAvailableForMating ?? 0)}
                  deltaText={null}
                  variant="green"
                />
              </View>
            </View>
          </ScreenSection>
          <ModuleAIInsights
            farmId={farmId}
            module="gestation"
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            hasMinimalData={(overviewQ.data?.kpis?.activeGestations ?? 0) > 0}
          />
          <ScreenSection title={t("gestationScreen.chartTitle")}>
            <SmartChart
              lines={chartLines}
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
              formatValue={(v) => String(Math.round(v))}
              emptyLabel={t("gestationScreen.chartEmpty")}
            />
          </ScreenSection>
          <ScreenSection
            title={t("gestationScreen.upcomingTitle")}
            headerRight={
              <TouchableOpacity onPress={() => setTab("active")}>
                <Text style={styles.link}>{t("gestationScreen.seeAll")}</Text>
              </TouchableOpacity>
            }
          >
            {(overviewQ.data?.upcomingBirths ?? []).map((u) => (
              <Pressable
                key={u.gestationId}
                style={styles.upcomingCard}
                onPress={() => setDetailId(u.gestationId)}
              >
                <Text style={styles.upcomingTitle}>
                  {urgencyEmoji(u.urgency)} {u.sowLabel}
                </Text>
                <Text style={styles.upcomingMeta}>
                  {u.expectedBirthDate.slice(0, 10)} ·{" "}
                  {t("gestationScreen.daysLeft", { count: u.daysRemaining })}
                </Text>
              </Pressable>
            ))}
          </ScreenSection>
        </>
      )}
    </>
  );

  const activeTabContent = (
    <>
      <TextInput
        style={styles.search}
        placeholder={t("gestationScreen.search")}
        value={search}
        onChangeText={setSearch}
      />
      <EventList
        layout="embedded"
        data={activeEvents}
        filters={[
          { id: "all", label: t("gestationScreen.filters.all") },
          { id: "due7", label: t("gestationScreen.filters.due7") },
          { id: "due30", label: t("gestationScreen.filters.due30") },
          { id: "t1", label: t("gestationScreen.filters.t1") },
          { id: "t2", label: t("gestationScreen.filters.t2") },
          { id: "t3", label: t("gestationScreen.filters.t3") }
        ]}
        activeFilterId={activeFilter}
        onFilterChange={setActiveFilter}
        onItemPress={(item) => setDetailId(item.id)}
        onAddPress={() => setCreateOpen(true)}
        isLoading={activeQ.isPending}
        emptyMessage={t("gestationScreen.emptyActive")}
        refreshing={activeQ.isFetching}
        onRefresh={() => void activeQ.refetch()}
      />
    </>
  );

  const planningTab = (
    <>
      <ScreenSection title={t("gestationScreen.availableSows")}>
        {availableQ.isPending ? (
          <ActivityIndicator />
        ) : (
          (availableQ.data?.items ?? []).map((s) => (
            <View key={s.sowId} style={styles.planCard}>
              <Text style={styles.planTitle}>{s.label}</Text>
              <Text style={styles.planMeta}>
                {t("gestationScreen.gestationCount", { count: s.gestationCount })}
                {s.lastFarrowingDate
                  ? ` · ${s.lastFarrowingDate.slice(0, 10)}`
                  : ""}
              </Text>
              <Text style={styles.planStatus}>
                {s.availability === "now"
                  ? `✅ ${t("gestationScreen.availableNow")}`
                  : `⏳ ${t("gestationScreen.availableIn", {
                      days: s.availableInDays
                    })}`}
              </Text>
            </View>
          ))
        )}
      </ScreenSection>
      <ScreenSection title={t("gestationScreen.boarsTitle")}>
        {males.slice(0, 12).map((b) => (
          <View key={b.id} style={styles.planCard}>
            <Text style={styles.planTitle}>
              {b.tagCode?.trim() || b.publicId.slice(0, 8)}
            </Text>
          </View>
        ))}
      </ScreenSection>
    </>
  );

  const historyTab = (
    <>
      {historyQ.data?.stats ? (
        <ScreenSection title={t("gestationScreen.tabs.history")}>
          <Text style={styles.statsLine}>
            {t("gestationScreen.statsTotal")}:{" "}
            {String(
              (historyQ.data.stats as { totalGestations?: number })
                .totalGestations ?? "—"
            )}
          </Text>
          <Text style={styles.statsLine}>
            {t("gestationScreen.kpiAvgLitter")}:{" "}
            {String(
              (historyQ.data.stats as { avgLitterSize?: number | null })
                .avgLitterSize ?? "—"
            )}
          </Text>
        </ScreenSection>
      ) : null}
      <EventList
        layout="embedded"
        data={historyEvents}
        filters={[
          { id: "all", label: t("gestationScreen.filters.all") },
          { id: "mating", label: t("gestationScreen.filters.mating") },
          { id: "farrowing", label: t("gestationScreen.filters.farrowing") },
          { id: "abortion", label: t("gestationScreen.filters.abortion") },
          { id: "vaccine", label: t("gestationScreen.filters.vaccine") }
        ]}
        activeFilterId={histFilter}
        onFilterChange={setHistFilter}
        isLoading={historyQ.isPending}
        emptyMessage={t("gestationScreen.emptyHistory")}
      />
    </>
  );

  return (
    <View style={styles.root}>
      <TabSelector
        activeTab={tab}
        onTabChange={(key) => setTab(key as TabId)}
        tabs={[
          {
            key: "overview",
            label: t("gestationScreen.tabs.overview"),
            content: tabScroll(overviewTab)
          },
          {
            key: "active",
            label: t("gestationScreen.tabs.active"),
            content: tabScroll(activeTabContent)
          },
          {
            key: "planning",
            label: t("gestationScreen.tabs.planning"),
            content: tabScroll(planningTab)
          },
          {
            key: "birth",
            label: t("gestationScreen.tabs.birth"),
            content: tabScroll(
              <EventList
                layout="embedded"
                data={activeEvents}
                onItemPress={(item) => setDetailId(item.id)}
                onAddPress={() => {
                  const first = activeQ.data?.items?.[0];
                  if (first) {
                    setLitterTarget({ id: first.id, label: first.sowLabel });
                  } else {
                    setCreateOpen(true);
                  }
                }}
                isLoading={activeQ.isPending}
                emptyMessage={t("gestationScreen.emptyBirth")}
                sectionTitle={t("gestationScreen.imminentBirths")}
              />
            )
          },
          {
            key: "history",
            label: t("gestationScreen.tabs.history"),
            content: tabScroll(historyTab)
          }
        ]}
      />

      <Pressable style={styles.fab} onPress={() => setCreateOpen(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <CreateGestationModal
        visible={createOpen}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        females={females}
        males={males}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
        onSuccess={() => {
          invalidate();
          Alert.alert(t("gestationScreen.createSuccessTitle"));
        }}
      />

      <GestationDetailModal
        visible={Boolean(detailId)}
        gestationId={detailId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        farmId={farmId}
        onClose={() => setDetailId(null)}
        onRefresh={invalidate}
        onRecordLitter={(id, label) => {
          setDetailId(null);
          setLitterTarget({ id, label });
        }}
        onOpenAnimal={(animalId, headline) => {
          setDetailId(null);
          navigation.navigate("AnimalDetail", {
            farmId,
            farmName,
            animalId,
            headline
          });
        }}
      />

      <MiseBasModal
        visible={Boolean(litterTarget)}
        farmId={farmId}
        gestationId={litterTarget?.id ?? ""}
        sowLabel={litterTarget?.label ?? ""}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setLitterTarget(null)}
        onSaved={invalidate}
      />
    </View>
  );
}

function gestationToEvent(
  g: GestationListItemDto,
  t: (k: string, o?: Record<string, unknown>) => string
): EventItem {
  const prog = g.progress;
  return {
    id: g.id,
    title: `${urgencyEmoji(prog?.urgency)} ${g.sowLabel}`,
    subtitle: `${g.matingDate.slice(0, 10)} → ${g.expectedBirthDate.slice(0, 10)}`,
    value: prog
      ? t("gestationScreen.weekProgress", {
          week: prog.weekCurrent,
          total: prog.weekTotal,
          days: prog.daysRemaining
        })
      : "—",
    valueType: "neutral",
    date: g.expectedBirthDate.slice(0, 10),
    iconType: "custom",
    customIcon: "egg-outline",
    meta: g
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  scroll: {
    padding: mobileSpacing.md,
    paddingBottom: 100,
    gap: mobileSpacing.md
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  kpiHalf: { width: "48%" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    ...mobileTypography.sectionTitle,
    color: mobileColors.textPrimary
  },
  link: { color: mobileColors.accent, fontWeight: "600" },
  upcomingCard: {
    backgroundColor: "#fff",
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    ...mobileShadows.card
  },
  upcomingTitle: { fontWeight: "600" },
  upcomingMeta: { fontSize: 13, color: mobileColors.textSecondary, marginTop: 4 },
  search: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    backgroundColor: "#fff",
    marginBottom: mobileSpacing.sm
  },
  planCard: {
    backgroundColor: "#fff",
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    marginBottom: mobileSpacing.sm,
    ...mobileShadows.card
  },
  planTitle: { fontWeight: "600" },
  planMeta: { fontSize: 12, color: mobileColors.textSecondary, marginTop: 4 },
  planStatus: { marginTop: 6, fontSize: 13 },
  statsBlock: {
    backgroundColor: mobileColors.surfaceMuted,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    gap: 4
  },
  statsLine: { fontSize: 13 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...mobileShadows.card
  }
});
