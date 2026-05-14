import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState, useCallback } from "react";
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
import { FeedStockLineChart } from "../components/feed/FeedStockLineChart";
import { StockModal } from "../components/feed/StockModal";
import { FeedStockModuleGate } from "../components/FeedStockModuleGate";
import { EventList, type EventItem } from "../components/lists";
import { useModal } from "../components/modals/useModal";
import { useSession } from "../context/SessionContext";
import type { FarmFeedStatItemDto, FeedStockMovementDto } from "../lib/api";
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

function formatMassKg(kg: number): string {
  if (!Number.isFinite(kg)) return "—";
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} t`;
  }
  return `${kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;
}

function statusEmoji(s: FarmFeedStatItemDto["status"]): string {
  if (s === "critical") return "🔴";
  if (s === "warning") return "🟡";
  return "🟢";
}

export function FarmFeedStockScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const { t } = useTranslation();
  const { open } = useModal();
  const [period, setPeriod] = useState<"3m" | "6m" | "12m">("6m");
  const [stockOpen, setStockOpen] = useState(false);
  const [movFilterType, setMovFilterType] = useState<string>("");
  const [movKindFilter, setMovKindFilter] = useState<"all" | "in" | "stock_check">("all");
  const [movFrom, setMovFrom] = useState("");
  const [movTo, setMovTo] = useState("");

  const periodLabels = useMemo(
    () =>
      [
        { key: "3m" as const, label: t("feedStock.period3") },
        { key: "6m" as const, label: t("feedStock.period6") },
        { key: "12m" as const, label: t("feedStock.period12") }
      ],
    [t]
  );

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
    if (movKindFilter === "in") {
      return movements.filter((x) => x.kind === "in");
    }
    if (movKindFilter === "stock_check") {
      return movements.filter((x) => x.kind === "stock_check");
    }
    return movements;
  }, [movements, movKindFilter]);

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
        subtitle: kindLabel,
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
      { id: "stock_check", label: t("feedStock.kindCheck") }
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
        <Text style={styles.filterLab}>{t("feedStock.filterFrom")}</Text>
        <TextInput
          style={styles.fInput}
          value={movFrom}
          onChangeText={setMovFrom}
          placeholder="YYYY-MM-DD"
        />
        <Text style={styles.filterLab}>{t("feedStock.filterTo")}</Text>
        <TextInput
          style={styles.fInput}
          value={movTo}
          onChangeText={setMovTo}
          placeholder="YYYY-MM-DD"
        />
      </View>
    ),
    [movFilterType, movFrom, movTo, types, t]
  );

  const renderStockMovDetail = useCallback(
    (item: EventItem, _ctx: { close: () => void }) => {
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
        </View>
      );
    },
    [t]
  );

  const onStockKindFilter = useCallback((id: string) => {
    if (id === "in") setMovKindFilter("in");
    else if (id === "stock_check") setMovKindFilter("stock_check");
    else setMovKindFilter("all");
  }, []);

  const pending = results.some((r) => r.isPending) || movQ.isPending;
  const errMsg = useMemo(() => {
    for (const r of [...results, movQ]) {
      if (r.error instanceof Error) return r.error.message;
    }
    return null;
  }, [results, movQ]);

  useLayoutEffect(() => {
    navigation.setOptions({
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
  }, [navigation, clientFeatures.feedStock, t]);

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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refetchAll()}
            tintColor={mobileColors.accent}
          />
        }
      >
        <Text style={styles.screenTitle}>{t("feedStock.title")}</Text>
        <Text style={styles.farmHint}>{farmName}</Text>
        <Text style={styles.global}>
          {t("feedStock.globalStock")} :{" "}
          <Text style={styles.globalVal}>{formatMassKg(totalKg)}</Text>
        </Text>

        <Text style={styles.section}>{t("feedStock.chartTitle")}</Text>
        <FeedStockLineChart
          title={t("feedStock.chartTitle")}
          chart={chart}
          period={period}
          onPeriodChange={setPeriod}
          periodLabels={periodLabels}
        />

        <Text style={[styles.section, styles.sectionSp]}>
          {t("feedStock.statsTitle")}
        </Text>
        {stats.length === 0 ? (
          <Text style={styles.muted}>{t("feedStock.noStats")}</Text>
        ) : (
          stats.map((s) => (
            <View key={s.feedTypeId} style={styles.statCard}>
              <View style={styles.statHead}>
                <View
                  style={[styles.dot, { backgroundColor: s.color || mobileColors.accent }]}
                />
                <Text style={styles.statName}>{s.name}</Text>
                <Text style={styles.statEmoji}>{statusEmoji(s.status)}</Text>
              </View>
              <Text style={styles.statLine}>
                {t("feedStock.current")} :{" "}
                {formatMassKg(Number.parseFloat(s.currentStockKg))}
              </Text>
              <Text style={styles.statLine}>
                {t("feedStock.avgDaily")} :{" "}
                {s.avgDailyConsumptionKg
                  ? `${Number.parseFloat(s.avgDailyConsumptionKg).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg/j`
                  : "—"}
              </Text>
              <Text style={styles.statLine}>
                {t("feedStock.depletion")} :{" "}
                {s.estimatedDepletionDate
                  ? new Date(s.estimatedDepletionDate).toLocaleDateString("fr-FR")
                  : "—"}
              </Text>
              <Text style={styles.statLine}>
                {s.status === "ok"
                  ? t("feedStock.statusOk")
                  : s.status === "warning"
                    ? t("feedStock.statusWarn")
                    : t("feedStock.statusCrit")}
              </Text>
            </View>
          ))
        )}

        <Text style={[styles.section, styles.sectionSp]}>
          {t("feedStock.smartAlertsHintTitle", "Recommandations")}
        </Text>
        <View style={styles.card}>
          <Text style={styles.muted}>
            {t(
              "feedStock.smartAlertsHintBody",
              "Les alertes stock et consommation sont sur le tableau de bord (section Recommandations)."
            )}
          </Text>
        </View>

        <Text style={[styles.section, styles.sectionSp]}>
          {t("feedStock.movementsTitle")}
        </Text>
        <EventList
          layout="embedded"
          data={feedMovementEvents}
          filters={stockKindPills}
          activeFilterId={movKindFilter}
          onFilterChange={onStockKindFilter}
          renderDetail={renderStockMovDetail}
          prependContent={movementFiltersExtra}
          emptyMessage={t("feedStock.noMovements")}
          isLoading={movQ.isPending && movements.length === 0}
          pageSize={25}
          loadMoreLabel={t("feedStock.loadMore")}
        />
      </ScrollView>

      {accessToken ? (
        <StockModal
          visible={stockOpen}
          onClose={() => setStockOpen(false)}
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          types={types}
          onSuccess={() =>
            open("success", {
              message: t("feedStock.successMessage"),
              autoDismissMs: 2000
            })
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.surface },
  scroll: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl * 2
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.surface
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
  section: {
    ...mobileTypography.cardTitle,
    marginTop: mobileSpacing.lg,
    color: mobileColors.textPrimary
  },
  sectionSp: { marginTop: mobileSpacing.xl },
  muted: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  statCard: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  statHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: mobileSpacing.xs
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statName: { flex: 1, fontWeight: "800", color: mobileColors.textPrimary },
  statEmoji: { fontSize: 16 },
  statLine: { ...mobileTypography.body, color: mobileColors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
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
  headerBtn: { marginRight: mobileSpacing.sm },
  headerBtnText: { color: mobileColors.accent, fontWeight: "700", fontSize: 15 }
});
