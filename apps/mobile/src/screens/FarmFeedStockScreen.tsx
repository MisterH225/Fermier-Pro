import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { TabScreenHeader } from "../components/layout";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import {
  SmartChart,
  feedChartToLines,
  feedPeriodToChartPeriod,
  chartPeriodToFeedPeriod
} from "../components/charts";
import { AppDateRangePicker } from "../components/common/AppDateRangePicker";
import { StockModal, FeedStockLevelGauge, farmFeedStatToGauge } from "../components/feed";
import { HighlightWrapper } from "../components/common/HighlightWrapper";
import { EditStockModal } from "../components/stock/EditStockModal";
import { LinkedFinanceSection } from "../components/stock/LinkedFinanceSection";
import { ReconciliationAlertModal } from "../components/stock/ReconciliationAlertModal";
import type { PostFarmFeedMovementResponse, ReconciliationOfferDto } from "../lib/api";
import { FeedStockModuleGate } from "../components/FeedStockModuleGate";
import { EventList, type EventItem } from "../components/lists";
import { ModuleAIInsights } from "../components/ai/ModuleAIInsights";
import { ScreenSection } from "../components/layout/ScreenSection";
import { TabContent, TabSelector } from "../components/tabs";
import { invalidateAIInsights } from "../services/ai/AIRecommendationService";
import { useModal } from "../components/modals/useModal";
import { useSession } from "../context/SessionContext";
import type { FeedStockMovementDto } from "../lib/api";
import {
  fetchFarmFeedChart,
  fetchFarmFeedMovements,
  fetchFarmFeedOverview,
  fetchFarmFeedStats,
  fetchFarmFeedTypes
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FarmFeedStock">;

function getUtcWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
}

function formatMassKg(kg: number): string {
  if (!Number.isFinite(kg)) return "—";
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} t`;
  }
  return `${kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;
}

export function FarmFeedStockScreen({ route, navigation }: Props) {
  const params = route.params ?? {};
  const {
    farmId = "",
    farmName = "",
    feedTab: feedTabParam,
    openFeedTypeId,
    highlightFeedType,
    autoOpenControl,
    filterCostMissing,
    costFilter
  } = params;
  const session = useSession();
  const accessToken = session?.accessToken ?? "";
  const activeProfileId = session?.activeProfileId ?? null;
  const clientFeatures = session?.clientFeatures ?? { feedStock: false };
  const { t, i18n } = useTranslation();
  const { open } = useModal();
  const [period, setPeriod] = useState<"3m" | "6m" | "12m">("6m");
  const [stockOpen, setStockOpen] = useState(false);
  const [stockModalDefaultTab, setStockModalDefaultTab] = useState<
    "in" | "stock_check"
  >("in");
  const [movFilterType, setMovFilterType] = useState<string>("");
  const [feedTab, setFeedTab] = useState<"overview" | "movements" | "controls">("overview");
  const [movKindFilter, setMovKindFilter] = useState<
    "all" | "in" | "stock_check" | "missing_cost"
  >("all");
  const [movFrom, setMovFrom] = useState("");
  const [movTo, setMovTo] = useState("");
  const [editMovement, setEditMovement] = useState<FeedStockMovementDto | null>(
    null
  );
  const [reconciliationOffer, setReconciliationOffer] =
    useState<ReconciliationOfferDto | null>(null);
  const [highlightFeedId, setHighlightFeedId] = useState<string | null>(null);

  useEffect(() => {
    if (feedTabParam) {
      setFeedTab(feedTabParam);
    }
    if (filterCostMissing || costFilter === "missing") {
      setFeedTab("movements");
      setMovKindFilter("missing_cost");
    }
    if (openFeedTypeId) {
      setMovFilterType(openFeedTypeId);
      if (highlightFeedType) {
        setHighlightFeedId(openFeedTypeId);
        const t = setTimeout(() => setHighlightFeedId(null), 2200);
        return () => clearTimeout(t);
      }
    }
    if (autoOpenControl) {
      setFeedTab("controls");
      setStockModalDefaultTab("stock_check");
      const t = setTimeout(() => setStockOpen(true), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [
    feedTabParam,
    openFeedTypeId,
    highlightFeedType,
    autoOpenControl,
    filterCostMissing,
    costFilter
  ]);

  const enabled = clientFeatures.feedStock && Boolean(accessToken);

  const results = useQueries({
    queries: [
      {
        queryKey: ["farmFeed", farmId, "types", activeProfileId],
        queryFn: () => fetchFarmFeedTypes(accessToken!, farmId, activeProfileId),
        enabled
      },
      {
        queryKey: ["farmFeed", farmId, "overview", activeProfileId],
        queryFn: () => fetchFarmFeedOverview(accessToken!, farmId, activeProfileId),
        enabled
      },
      {
        queryKey: ["farmFeed", farmId, "chart", period, activeProfileId],
        queryFn: () =>
          fetchFarmFeedChart(accessToken!, farmId, period, activeProfileId),
        enabled
      },
      {
        queryKey: ["farmFeed", farmId, "stats", activeProfileId],
        queryFn: () => fetchFarmFeedStats(accessToken!, farmId, activeProfileId),
        enabled
      }
    ]
  });

  const [typesQ, overviewQ, chartQ, statsQ] = results;

  const movQ = useQuery({
    queryKey: [
      "farmFeed",
      farmId,
      "movements",
      movFilterType,
      movFrom,
      movTo,
      activeProfileId
    ],
    queryFn: () =>
      fetchFarmFeedMovements(accessToken!, farmId, activeProfileId, {
        feedTypeId: movFilterType || undefined,
        from: movFrom || undefined,
        to: movTo || undefined
      }),
    enabled
  });

  const refreshing =
    results.some((r) => r.isFetching) || movQ.isFetching;

  const refetchAll = () => {
    void Promise.all([
      ...results.map((r) => r.refetch()),
      movQ.refetch()
    ]);
  };

  const types = typesQ.data ?? [];
  const overview = overviewQ.data;
  const chart = chartQ.data;
  const stats = statsQ.data?.items ?? [];
  const movements = movQ.data ?? [];

  const movementsFiltered = useMemo(() => {
    if (feedTab === "controls") {
      return movements.filter((x) => x.kind === "stock_check");
    }
    if (movKindFilter === "in") {
      return movements.filter((x) => x.kind === "in");
    }
    if (movKindFilter === "stock_check") {
      return movements.filter((x) => x.kind === "stock_check");
    }
    if (movKindFilter === "missing_cost") {
      return movements.filter((x) => x.kind === "in" && x.isCostMissing);
    }
    return movements;
  }, [movements, movKindFilter, feedTab]);

  const feedMovementEvents = useMemo((): EventItem[] => {
    return movementsFiltered.map((m) => {
      const kindLabel =
        m.kind === "in" ? t("feedStock.movementIn") : t("feedStock.movementCheck");
      const qty =
        m.kind === "in" && m.quantityKg
          ? `+${Number.parseFloat(m.quantityKg).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`
          : m.bagsConsumed != null
            ? `${Number.parseFloat(m.bagsConsumed).toFixed(1)} sacs`
            : "—";
      const dateShort = new Date(m.occurredAt).toLocaleDateString("fr-FR");
      return {
        id: m.id,
        title: m.feedType.name,
        subtitle: [
          kindLabel,
          m.linkedExpenseId ? t("financeStockLink.financeBadge") : null,
          m.isCostMissing ? t("feedStock.badgeMissingCost") : null
        ]
          .filter(Boolean)
          .join(" · "),
        value: qty,
        valueType: m.kind === "in" ? "positive" : "neutral",
        date: dateShort,
        iconType: m.kind === "in" ? "in" : "check",
        meta: m
      };
    });
  }, [movementsFiltered, t]);

  const stockKindPills = useMemo(
    () => [
      { id: "all", label: t("feedStock.kindAll") },
      { id: "in", label: t("feedStock.kindIn") },
      { id: "stock_check", label: t("feedStock.kindCheck") },
      { id: "missing_cost", label: t("feedStock.filterMissingCost") }
    ],
    [t]
  );

  const movementFiltersExtra = useMemo(
    () => (
      <View style={styles.filters}>
        <Text style={styles.filterLab}>{t("feedStock.filterType")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            style={[styles.fChip, !movFilterType && styles.fChipOn]}
            onPress={() => setMovFilterType("")}
          >
            <Text style={styles.fChipTx}>{t("feedStock.filterAll")}</Text>
          </Pressable>
          {types.map((ft) => (
            <Pressable
              key={ft.id}
              style={[styles.fChip, movFilterType === ft.id && styles.fChipOn]}
              onPress={() => setMovFilterType(ft.id)}
            >
              <Text style={styles.fChipTx}>{ft.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <AppDateRangePicker
          startIso={movFrom}
          endIso={movTo}
          onChange={(from, to) => {
            setMovFrom(from);
            setMovTo(to);
          }}
          farmId={farmId}
          startLabel={t("feedStock.filterFrom")}
          endLabel={t("feedStock.filterTo")}
        />
      </View>
    ),
    [movFilterType, movFrom, movTo, types, t]
  );

  const renderStockMovDetail = useCallback(
    (item: EventItem, ctx: { close: () => void }) => {
      const m = item.meta as FeedStockMovementDto;
      return (
        <View style={{ paddingBottom: mobileSpacing.md, gap: mobileSpacing.sm }}>
          <Text style={{ ...mobileTypography.meta, color: mobileColors.textSecondary }}>
            {new Date(m.occurredAt).toLocaleString("fr-FR")}
          </Text>
          <Text style={{ ...mobileTypography.body, color: mobileColors.textPrimary }}>
            {m.kind === "in" ? t("feedStock.movementIn") : t("feedStock.movementCheck")}
          </Text>
          {m.notes ? <Text style={{ ...mobileTypography.body }}>{m.notes}</Text> : null}
          {accessToken ? (
            <LinkedFinanceSection
              farmId={farmId}
              accessToken={accessToken}
              activeProfileId={activeProfileId}
              movement={m}
            />
          ) : null}
          {m.kind === "in" ? (
            <Pressable
              style={styles.editBtn}
              onPress={() => {
                ctx.close();
                setEditMovement(m);
              }}
            >
              <Text style={styles.editBtnTx}>{t("feedStock.editMovement")}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    },
    [t, accessToken, farmId, activeProfileId]
  );

  const onStockKindFilter = useCallback((id: string) => {
    if (id === "in") setMovKindFilter("in");
    else if (id === "stock_check") setMovKindFilter("stock_check");
    else if (id === "missing_cost") setMovKindFilter("missing_cost");
    else setMovKindFilter("all");
  }, []);

  const handleStockSaved = useCallback(
    (res?: PostFarmFeedMovementResponse) => {
      refetchAll();
      if (res?.reconciliation && res.reconciliation.status !== "none") {
        setReconciliationOffer(res.reconciliation);
      }
    },
    [refetchAll]
  );

  const renderStockSwipeEdit = useCallback(
    (item: EventItem) => {
      const m = item.meta as FeedStockMovementDto;
      if (m.kind !== "in") {
        return null;
      }
      return (
        <Pressable
          style={styles.swipeEdit}
          onPress={() => setEditMovement(m)}
          accessibilityRole="button"
          accessibilityLabel={t("feedStock.editMovement")}
        >
          <Ionicons name="pencil" size={20} color="#fff" />
          <Text style={styles.swipeEditTx}>{t("feedStock.editMovement")}</Text>
        </Pressable>
      );
    },
    [t]
  );

  const pending = results.some((r) => r.isPending) || movQ.isPending;
  const errMsg = useMemo(() => {
    for (const r of [...results, movQ]) {
      if (r.error instanceof Error) return r.error.message;
    }
    return null;
  }, [results, movQ]);

  useScreenTitle(navigation, t("navigation.screenTitles.feedStock"), {
    headerRight: clientFeatures.feedStock
      ? () => (
          <TouchableOpacity
            onPress={() => setStockOpen(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerBtnText}>➕ {t("feedStock.add")}</Text>
          </TouchableOpacity>
        )
      : undefined
  });

  if (!farmId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Configuration manquante</Text>
      </View>
    );
  }

  if (!clientFeatures.feedStock) {
    return (
      <FeedStockModuleGate>
        <View />
      </FeedStockModuleGate>
    );
  }

  if (pending && !overview) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (errMsg && !overview) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{errMsg}</Text>
      </View>
    );
  }

  const totalKg = overview ? Number.parseFloat(overview.totalStockKg) : 0;

  const tabScroll = (children: ReactNode) => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabScrollGrow}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refetchAll()}
          tintColor={mobileColors.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <TabContent>{children}</TabContent>
    </ScrollView>
  );

  const movementList = (showKindPills: boolean) => (
    <EventList
      layout="embedded"
      sectionTitle={t("feedStock.movementsTitle")}
      data={feedMovementEvents}
      filters={showKindPills ? stockKindPills : undefined}
      activeFilterId={showKindPills ? movKindFilter : undefined}
      onFilterChange={showKindPills ? onStockKindFilter : undefined}
      renderDetail={renderStockMovDetail}
      renderSwipeRight={renderStockSwipeEdit}
      prependContent={movementFiltersExtra}
      emptyMessage={t("feedStock.noMovements")}
      isLoading={movQ.isPending && movements.length === 0}
      pageSize={25}
      loadMoreLabel={t("feedStock.loadMore")}
    />
  );

  return (
    <View style={styles.root}>
      <TabSelector
        activeTab={feedTab}
        onTabChange={(key) => {
          const tab = key as typeof feedTab;
          setFeedTab(tab);
          if (tab === "controls") {
            setMovKindFilter("stock_check");
          } else if (tab === "movements") {
            setMovKindFilter("all");
          }
        }}
        header={
          <TabScreenHeader>
            <Text style={styles.global}>
              {t("feedStock.globalStock")} :{" "}
              <Text style={styles.globalVal}>{formatMassKg(totalKg)}</Text>
            </Text>
          </TabScreenHeader>
        }
        tabs={[
          {
            key: "overview",
            label: t("feedStock.tabOverview"),
            content: tabScroll(
              <>
                <ScreenSection title={t("feedStock.chartTitle")}>
                  {chart ? (
                    <SmartChart
                      lines={feedChartToLines(chart)}
                      period={feedPeriodToChartPeriod(period)}
                      skipPeriodSlice
                      onPeriodChange={(p) => setPeriod(chartPeriodToFeedPeriod(p))}
                      formatValue={(v) =>
                        `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`
                      }
                      monthLabel={(weekEnd) => {
                        const d = new Date(`${weekEnd}T12:00:00.000Z`);
                        if (Number.isNaN(d.getTime())) {
                          return weekEnd;
                        }
                        const locale = i18n.language === "en" ? "en-US" : "fr-FR";
                        const weekNo = getUtcWeekNumber(d);
                        const shortDate = d.toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short"
                        });
                        return t("feedStock.chartWeekLabel", {
                          week: weekNo,
                          date: shortDate
                        });
                      }}
                    />
                  ) : (
                    <Text style={styles.muted}>—</Text>
                  )}
                </ScreenSection>
                <ModuleAIInsights
                  farmId={farmId}
                  module="stock"
                  accessToken={accessToken}
                  activeProfileId={activeProfileId}
                  hasMinimalData={stats.length > 0}
                />
                <ScreenSection title={t("feedStock.statsTitle")}>
                {!stats || stats.length === 0 ? (
                  <Text style={styles.muted}>{t("feedStock.noStats")}</Text>
                ) : (
                  stats.map((s, statIndex) => {
                    if (!s || !s.feedTypeId) return null;
                    try {
                      const gauge = farmFeedStatToGauge(s, statIndex, t);
                      return (
                        <HighlightWrapper
                          key={gauge.key || `stat-${statIndex}`}
                          active={highlightFeedId === gauge.key}
                        >
                          <FeedStockLevelGauge
                            name={gauge.name || "—"}
                            subtitle={gauge.subtitle || ""}
                            displayValue={gauge.displayValue || "—"}
                            percent={gauge.percent}
                            gaugeColor={gauge.gaugeColor || mobileColors.accent}
                            dotColor={gauge.dotColor || mobileColors.accent}
                            centerLabel={gauge.centerLabel}
                          />
                        </HighlightWrapper>
                      );
                    } catch {
                      return null;
                    }
                  })
                )}
                </ScreenSection>
                <ScreenSection title={t("feedStock.smartAlertsHintTitle", "Recommandations")}>
                  <Text style={styles.muted}>
                    {t(
                      "feedStock.smartAlertsHintBody",
                      "Les alertes stock et consommation sont sur le tableau de bord (section Recommandations)."
                    )}
                  </Text>
                </ScreenSection>
              </>
            )
          },
          {
            key: "movements",
            label: t("feedStock.tabMovements"),
            content: tabScroll(movementList(true))
          },
          {
            key: "controls",
            label: t("feedStock.tabControls"),
            content: tabScroll(movementList(false))
          }
        ]}
      />

      {accessToken ? (
        <>
        <StockModal
          visible={stockOpen}
          onClose={() => {
            setStockOpen(false);
            setStockModalDefaultTab("in");
          }}
          defaultTab={stockModalDefaultTab}
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          types={types}
          onSuccess={(res) => {
            void invalidateAIInsights(farmId, "stock");
            void invalidateAIInsights(farmId, "global_dashboard");
            handleStockSaved(res);
            if (!res?.reconciliation) {
              open("success", {
                message: t("feedStock.successMessage"),
                autoDismissMs: 2000
              });
            }
          }}
        />
        {editMovement ? (
          <EditStockModal
            visible
            movement={editMovement}
            types={types}
            farmId={farmId}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            onClose={() => setEditMovement(null)}
            onSaved={(res) => {
              handleStockSaved(res);
            }}
          />
        ) : null}
        {reconciliationOffer ? (
          <ReconciliationAlertModal
            visible
            offer={reconciliationOffer}
            farmId={farmId}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            onClose={() => setReconciliationOffer(null)}
            onDone={() => {
              refetchAll();
              void invalidateAIInsights(farmId, "stock");
            }}
          />
        ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  tabScroll: { flex: 1 },
  tabScrollGrow: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.canvas
  },
  error: { color: mobileColors.error, padding: mobileSpacing.lg },
  screenTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 22,
    color: mobileColors.textPrimary
  },
  farmHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  global: {
    ...mobileTypography.body,
    marginTop: mobileSpacing.md,
    color: mobileColors.textSecondary
  },
  globalVal: { fontWeight: "800", color: mobileColors.textPrimary },
  chartCard: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    ...mobileShadows.card
  },
  chartTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  section: {
    ...mobileTypography.cardTitle,
    marginTop: mobileSpacing.lg,
    color: mobileColors.textPrimary
  },
  sectionSp: { marginTop: mobileSpacing.xl },
  muted: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  headerBtn: { marginRight: mobileSpacing.sm },
  headerBtnText: { color: mobileColors.accent, fontWeight: "700", fontSize: 15 },
  filters: { marginBottom: mobileSpacing.md },
  filterLab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  fChip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    marginRight: mobileSpacing.sm
  },
  fChipOn: { borderColor: mobileColors.accent, backgroundColor: mobileColors.accentSoft },
  fChipTx: { fontWeight: "600", color: mobileColors.textPrimary },
  fInput: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    marginTop: 4,
    color: mobileColors.textPrimary
  },
  editBtn: {
    marginTop: mobileSpacing.md,
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft
  },
  editBtnTx: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  swipeEdit: {
    backgroundColor: mobileColors.accent,
    justifyContent: "center",
    alignItems: "center",
    width: 96,
    marginVertical: 4,
    borderTopRightRadius: mobileRadius.md,
    borderBottomRightRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.sm,
    gap: 4
  },
  swipeEditTx: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  }
});
