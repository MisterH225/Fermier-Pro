import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useCallback, type ReactNode } from "react";
import { ScreenSection, TabScreenHeader } from "../components/layout";
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
  TouchableOpacity,
  View
} from "react-native";
import { ModuleAIInsights } from "../components/ai/ModuleAIInsights";
import { TabContent, TabSelector } from "../components/tabs";
import { BudgetScreen } from "../components/finance/budget";
import {
  SmartChart,
  FinanceKpiCard,
  FinanceDonutChart,
  financeCategoryColor,
  formatFinanceChartValue,
  financeMonthsToRevExpLines,
  financeMonthsToSingleLine,
  budgetVsExpenseLines,
  type SmartChartPeriod
} from "../components/finance";

type CategoryBreakdownItem = {
  label: string;
  value: number;
  display: string;
  color: string;
};
import { FinanceModuleGate } from "../components/FinanceModuleGate";
import { EventList, type EventItem } from "../components/lists";
import { useModal } from "../components/modals/useModal";
import { useSession } from "../context/SessionContext";
import type {
  FinanceCategoryDto,
  FinanceMergedTransactionDto,
  FinanceOverviewDto,
  FinanceReportDto
} from "../lib/api";
import {
  deleteFarmExpense,
  deleteFarmRevenue,
  fetchFarmBatches,
  fetchFarmBudget,
  fetchFinanceCategories,
  fetchFinanceMarginByBatch,
  fetchFinanceOverview,
  fetchFinanceProjection,
  fetchFinanceReport,
  fetchFinanceTransactions
} from "../lib/api";
import { invalidateFarmFinanceQueries } from "../lib/invalidateFarmFinanceQueries";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FarmFinance">;

function pctDeltaString(cur: number, prev: number): string | null {
  if (!Number.isFinite(prev) || prev === 0) {
    return null;
  }
  const p = ((cur - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

function monthShort(iso: string, locale: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) {
    return iso;
  }
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(locale, { month: "short" });
}

function newFarmTransactionRef(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    return `FP-${c.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  }
  return `FP-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase()}`;
}

function formatMoney(
  amount: string | number,
  currencyCode: string,
  currencySymbol?: string
): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  const iso = currencyCode?.length === 3 ? currencyCode : "XOF";
  try {
    const s = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: iso,
      maximumFractionDigits: 0
    }).format(n);
    return currencySymbol && iso === "XOF" && currencySymbol !== "XOF"
      ? s.replace("F CFA", currencySymbol).replace("FCFA", currencySymbol)
      : s;
  } catch {
    return `${n} ${currencySymbol ?? currencyCode}`;
  }
}

function currentMonthUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseMonthUtc(iso: string): { year: number; month: number } {
  const [y, m] = iso.split("-").map(Number);
  return { year: y ?? new Date().getUTCFullYear(), month: m ?? 1 };
}

function shiftMonthUtc(iso: string, delta: number): string {
  const { year, month } = parseMonthUtc(iso);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentYearUtc(): string {
  return String(new Date().getUTCFullYear());
}

export function FarmFinanceScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const localeStr = i18n.language === "en" ? "en-US" : "fr-FR";
  const { open } = useModal();

  const [reportPeriod, setReportPeriod] = useState<"month" | "year">("month");
  const [reportMonth, setReportMonth] = useState(() => currentMonthUtc());
  const [reportYear, setReportYear] = useState(() => currentYearUtc());
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [financeTab, setFinanceTab] = useState("overview");
  const [chartPeriod, setChartPeriod] = useState<SmartChartPeriod>("6M");
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const enabled = clientFeatures.finance;

  const queries = useQueries({
    queries: [
      {
        queryKey: ["financeOverview", farmId, activeProfileId],
        queryFn: () => fetchFinanceOverview(accessToken!, farmId, activeProfileId),
        enabled: enabled && Boolean(accessToken)
      },
      {
        queryKey: ["financeTransactions", farmId, activeProfileId],
        queryFn: () =>
          fetchFinanceTransactions(accessToken!, farmId, activeProfileId),
        enabled: enabled && Boolean(accessToken)
      },
      {
        queryKey: ["financeCategories", farmId, activeProfileId],
        queryFn: () => fetchFinanceCategories(accessToken!, farmId, activeProfileId),
        enabled: enabled && Boolean(accessToken)
      },
      {
        queryKey: ["financeBatches", farmId, activeProfileId],
        queryFn: () => fetchFarmBatches(accessToken!, farmId, activeProfileId),
        enabled: enabled && Boolean(accessToken)
      }
    ]
  });

  const [overviewQ, txQ, catQ, batchesQ] = queries;

  const reportQ = useQuery({
    queryKey: [
      "financeReport",
      farmId,
      activeProfileId,
      reportPeriod,
      reportMonth,
      reportYear
    ],
    queryFn: () =>
      fetchFinanceReport(
        accessToken!,
        farmId,
        activeProfileId,
        reportPeriod,
        reportPeriod === "month" ? reportMonth : undefined,
        reportPeriod === "year" ? reportYear : undefined
      ),
    enabled: enabled && Boolean(accessToken)
  });

  const projectionQ = useQuery({
    queryKey: ["financeProjection", farmId, activeProfileId],
    queryFn: () => fetchFinanceProjection(accessToken!, farmId, activeProfileId),
    enabled: enabled && Boolean(accessToken)
  });

  /** Mois de référence pour le budget (aligné sur le sélecteur de période). */
  const budgetAnchorRef = useMemo(() => {
    if (reportPeriod === "month") {
      return parseMonthUtc(reportMonth);
    }
    return { year: Number(reportYear), month: 12 };
  }, [reportPeriod, reportMonth, reportYear]);

  const budgetQ = useQuery({
    queryKey: [
      "farmBudget",
      farmId,
      budgetAnchorRef.year,
      budgetAnchorRef.month,
      activeProfileId
    ],
    queryFn: () =>
      fetchFarmBudget(
        accessToken!,
        farmId,
        budgetAnchorRef.year,
        budgetAnchorRef.month,
        activeProfileId
      ),
    enabled: enabled && Boolean(accessToken)
  });

  const marginQ = useQuery({
    queryKey: ["financeMargin", farmId, activeProfileId, selectedBatchId],
    queryFn: () =>
      fetchFinanceMarginByBatch(
        accessToken!,
        farmId,
        selectedBatchId!,
        activeProfileId
      ),
    enabled: enabled && Boolean(accessToken && selectedBatchId)
  });

  const report = reportQ.data as FinanceReportDto | undefined;
  const projection = projectionQ.data;

  const deleteMutation = useMutation({
    mutationFn: async (p: { kind: "expense" | "income"; id: string }) => {
      if (p.kind === "expense") {
        await deleteFarmExpense(accessToken!, farmId, p.id, activeProfileId);
      } else {
        await deleteFarmRevenue(accessToken!, farmId, p.id, activeProfileId);
      }
    },
    onSuccess: () => {
      invalidateFarmFinanceQueries(qc, farmId);
    },
    onError: (e: Error) => Alert.alert("Suppression impossible", e.message)
  });

  const overview = overviewQ.data as FinanceOverviewDto | undefined;
  const curCode = overview?.settings.currencyCode ?? "XOF";
  const curSym = overview?.settings.currencySymbol ?? "";

  const goEdit = useCallback(
    (txRow: FinanceMergedTransactionDto) => {
      if (!accessToken) {
        return;
      }
      open("edit-transaction", {
        farmId,
        accessToken,
        activeProfileId,
        categories: (catQ.data ?? []) as FinanceCategoryDto[],
        currencyCode: curCode,
        currencySymbol: curSym,
        transaction: txRow
      });
    },
    [
      open,
      accessToken,
      farmId,
      activeProfileId,
      catQ.data,
      curCode,
      curSym
    ]
  );

  const confirmDelete = useCallback(
    (txRow: FinanceMergedTransactionDto) => {
      open("confirm-delete", {
        message: txRow.label,
        onConfirm: () =>
          deleteMutation.mutateAsync({
            kind: txRow.kind,
            id: txRow.id
          })
      });
    },
    [open, deleteMutation]
  );

  useScreenTitle(navigation, farmName, {
    headerRight: clientFeatures.finance
      ? () => (
          <TouchableOpacity
            onPress={() => {
              if (!accessToken) {
                return;
              }
              const ov = overviewQ.data as FinanceOverviewDto | undefined;
              open("transaction", {
                farmId,
                farmName,
                accessToken,
                activeProfileId,
                categories: (catQ.data ?? []) as FinanceCategoryDto[],
                batches: (batchesQ.data ?? []) as import("../lib/api").BatchListItem[],
                currencyCode: ov?.settings.currencyCode ?? "XOF",
                currencySymbol: ov?.settings.currencySymbol ?? "",
                transactionRef: newFarmTransactionRef()
              });
            }}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerBtnText}>{t("financeScreen.newTx")}</Text>
          </TouchableOpacity>
        )
      : undefined
  });

  const transactions = (txQ.data ?? []) as FinanceMergedTransactionDto[];

  const months6 = useMemo(() => {
    const o = overviewQ.data as FinanceOverviewDto | undefined;
    if (o?.months6?.length) {
      return o.months6;
    }
    return o?.months3 ?? [];
  }, [overviewQ.data]);

  const txSorted = useMemo(
    () =>
      [...transactions].sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      ),
    [transactions]
  );

  const revSeries = useMemo(
    () => months6.map((m) => Number(m.revenues)),
    [months6]
  );
  const expSeries = useMemo(
    () => months6.map((m) => Number(m.expenses)),
    [months6]
  );
  const netSeries = useMemo(
    () => months6.map((m) => Number(m.revenues) - Number(m.expenses)),
    [months6]
  );

  const chartFmt = useCallback(
    (n: number) => formatFinanceChartValue(n, curSym || curCode),
    [curSym, curCode]
  );

  const reportPeriodLabel = useMemo(() => {
    if (reportPeriod === "year") {
      return reportYear;
    }
    const { year, month } = parseMonthUtc(reportMonth);
    const d = new Date(Date.UTC(year, month - 1, 1));
    return d.toLocaleDateString(localeStr, { month: "long", year: "numeric" });
  }, [reportPeriod, reportMonth, reportYear, localeStr]);

  const chartMonths = useMemo(() => {
    const ev = report?.monthlyEvolution;
    if (ev?.length) {
      return ev.map((m) => ({
        month: m.month,
        revenues: Number(m.revenues),
        expenses: Number(m.expenses),
        net: Number(m.net)
      }));
    }
    return months6.map((m) => ({
      month: m.month,
      revenues: Number(m.revenues),
      expenses: Number(m.expenses),
      net: Number(m.revenues) - Number(m.expenses)
    }));
  }, [report, months6]);

  const budgetsForChartQ = useQueries({
    queries: chartMonths.map((m) => {
      const ref = parseMonthUtc(m.month);
      return {
        queryKey: [
          "farmBudget",
          farmId,
          ref.year,
          ref.month,
          activeProfileId
        ],
        queryFn: () =>
          fetchFarmBudget(
            accessToken!,
            farmId,
            ref.year,
            ref.month,
            activeProfileId
          ),
        enabled: enabled && Boolean(accessToken),
        staleTime: 60_000
      };
    })
  });

  const budgetChartSeries = useMemo(() => {
    return chartMonths.map((m, i) => {
      const view = budgetsForChartQ[i]?.data;
      const planned =
        view?.configured && Number(view.global.totalPlanned) > 0
          ? Number(view.global.totalPlanned)
          : undefined;
      return {
        month: m.month,
        expenses: m.expenses,
        budget: planned
      };
    });
  }, [chartMonths, budgetsForChartQ]);

  /** Budget de la période sélectionnée (`FarmBudget`), sinon repli estimation. */
  const monthlyBudget = useMemo(() => {
    if (reportPeriod === "year") {
      const annualPlanned = budgetChartSeries.reduce(
        (s, m) => s + (m.budget ?? 0),
        0
      );
      if (annualPlanned > 0) {
        return annualPlanned;
      }
    } else {
      const budgetView = budgetQ.data;
      if (budgetView?.configured) {
        const planned = Number(budgetView.global.totalPlanned);
        if (Number.isFinite(planned) && planned > 0) {
          return planned;
        }
      }
      const fromProjection = projection?.nextMonths?.[0];
      if (fromProjection) {
        const n = Number(fromProjection.projectedExpenses);
        if (Number.isFinite(n) && n > 0) {
          return n;
        }
      }
    }
    if (chartMonths.length) {
      const sum = chartMonths.reduce((s, m) => s + m.expenses, 0);
      const avg = sum / chartMonths.length;
      const factor = reportPeriod === "year" ? chartMonths.length : 1;
      if (Number.isFinite(avg) && avg > 0) {
        return avg * factor;
      }
    }
    return 0;
  }, [
    budgetQ.data,
    projection,
    chartMonths,
    reportPeriod,
    budgetChartSeries
  ]);

  const selectedPeriodExpenses = useMemo(() => {
    if (report?.totals?.expenses != null) {
      const n = Number(report.totals.expenses);
      if (Number.isFinite(n)) {
        return n;
      }
    }
    if (reportPeriod === "month") {
      const row = chartMonths.find((m) => m.month === reportMonth);
      if (row) {
        return row.expenses;
      }
    }
    return Number(overview?.month.totalExpenses ?? 0);
  }, [report, reportPeriod, reportMonth, chartMonths, overview]);

  const budgetUsedPct =
    monthlyBudget > 0
      ? Math.round((selectedPeriodExpenses / monthlyBudget) * 100)
      : null;

  const showBudgetVsExpenseChart = useMemo(() => {
    if (!chartMonths.length) {
      return false;
    }
    const hasBudget = budgetChartSeries.some(
      (m) => m.budget != null && m.budget > 0
    );
    const hasExpenses = budgetChartSeries.some((m) => m.expenses > 0);
    return hasBudget || (monthlyBudget > 0 && hasExpenses);
  }, [chartMonths, budgetChartSeries, monthlyBudget]);

  const revExpChartLines = useMemo(
    () =>
      financeMonthsToRevExpLines(
        chartMonths,
        t("financeScreen.tabRevenues"),
        t("financeScreen.tabExpenses")
      ),
    [chartMonths, t]
  );

  const revDelta = useMemo(() => {
    if (months6.length < 2) {
      return null;
    }
    const pct = pctDeltaString(
      Number(months6[months6.length - 1]!.revenues),
      Number(months6[months6.length - 2]!.revenues)
    );
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months6, t]);

  const expDelta = useMemo(() => {
    if (months6.length < 2) {
      return null;
    }
    const pct = pctDeltaString(
      Number(months6[months6.length - 1]!.expenses),
      Number(months6[months6.length - 2]!.expenses)
    );
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months6, t]);

  const marginDelta = useMemo(() => {
    if (months6.length < 2) {
      return null;
    }
    const n1 =
      Number(months6[months6.length - 1]!.revenues) -
      Number(months6[months6.length - 1]!.expenses);
    const n0 =
      Number(months6[months6.length - 2]!.revenues) -
      Number(months6[months6.length - 2]!.expenses);
    const pct = pctDeltaString(n1, n0);
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months6, t]);

  const donutRevenues = useMemo((): CategoryBreakdownItem[] => {
    if (!report?.byCategory?.length) {
      return [];
    }
    const rows = report.byCategory
      .map((r) => ({ label: r.label, value: Number(r.revenues) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return rows.map((r, i) => ({
      label: r.label,
      value: r.value,
      display: formatMoney(r.value, report.currency, report.currencySymbol),
      color: financeCategoryColor(i)
    }));
  }, [report]);

  const donutExpenses = useMemo((): CategoryBreakdownItem[] => {
    if (report?.topExpenseCategories?.length) {
      return report.topExpenseCategories.map((c, i) => ({
        label: c.label,
        value: Number(c.expenses),
        display: formatMoney(c.expenses, report.currency, report.currencySymbol),
        color: financeCategoryColor(i)
      }));
    }
    if (!report?.byCategory?.length) {
      return [];
    }
    return report.byCategory
      .map((r) => ({ label: r.label, value: Number(r.expenses) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((r, i) => ({
        label: r.label,
        value: r.value,
        display: formatMoney(r.value, report.currency, report.currencySymbol),
        color: financeCategoryColor(i)
      }));
  }, [report]);

  const recentForTab = useMemo(() => {
    const limit = showAllTransactions ? 40 : 8;
    const base =
      financeTab === "revenus"
        ? txSorted.filter((x) => x.kind === "income")
        : financeTab === "depenses"
          ? txSorted.filter((x) => x.kind === "expense")
          : txSorted;
    return base.slice(0, limit);
  }, [financeTab, showAllTransactions, txSorted]);

  const financeEventItems = useMemo((): EventItem[] => {
    return recentForTab.map((txRow) => {
      const timeStr = new Date(txRow.occurredAt).toLocaleString(localeStr, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
      const signed =
        txRow.kind === "income"
          ? `+${formatMoney(txRow.amount, txRow.currency || curCode, curSym)}`
          : `−${formatMoney(txRow.amount, txRow.currency || curCode, curSym)}`;
      return {
        id: `${txRow.kind}-${txRow.id}`,
        title: txRow.label,
        subtitle: `${txRow.kind === "income" ? t("financeScreen.income") : t("financeScreen.expense")}${txRow.categoryLabel ? ` · ${txRow.categoryLabel}` : ""}`,
        value: signed,
        valueType: txRow.kind === "income" ? "positive" : "negative",
        date: timeStr,
        iconType: txRow.kind === "income" ? "in" : "out",
        meta: txRow
      };
    });
  }, [recentForTab, localeStr, curCode, curSym, t]);

  const renderFinanceTxDetail = useCallback(
    (item: EventItem, { close }: { close: () => void }) => {
      const txRow = item.meta as FinanceMergedTransactionDto;
      const fullDate = new Date(txRow.occurredAt).toLocaleString(localeStr);
      return (
        <View style={{ paddingBottom: mobileSpacing.md }}>
          <Text style={{ ...mobileTypography.body, color: mobileColors.textSecondary }}>
            {fullDate}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color:
                txRow.kind === "income" ? mobileColors.success : mobileColors.error,
              marginTop: mobileSpacing.sm
            }}
          >
            {item.value}
          </Text>
          {txRow.categoryLabel ? (
            <Text style={{ ...mobileTypography.meta, marginTop: mobileSpacing.xs }}>
              {txRow.categoryLabel}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: mobileSpacing.lg
            }}
          >
            <TouchableOpacity
              onPress={() => {
                close();
                goEdit(txRow);
              }}
            >
              <Text style={styles.rowEdit}>{t("financeScreen.editShort")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                close();
                confirmDelete(txRow);
              }}
            >
              <Text style={styles.rowDelete}>{t("financeScreen.deleteShort")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [confirmDelete, goEdit, localeStr, t]
  );

  const projectionChartMonths = useMemo(() => {
    if (!projection?.nextMonths.length) return [];
    return projection.nextMonths.map((m) => ({
      month: `M+${m.monthOffset}`,
      revenues: Number(m.projectedRevenues),
      expenses: Number(m.projectedExpenses),
      net: Number(m.projectedNet)
    }));
  }, [projection]);

  const projectionRevExpLines = useMemo(
    () =>
      financeMonthsToRevExpLines(
        projectionChartMonths,
        t("financeScreen.projectedRevenues"),
        t("financeScreen.projectedExpenses")
      ),
    [projectionChartMonths, t]
  );

  const projectionNetLines = useMemo(
    () =>
      financeMonthsToSingleLine(
        projectionChartMonths,
        "net",
        t("financeScreen.projNet"),
        mobileColors.accent,
        (m) => Number(m.net ?? 0)
      ),
    [projectionChartMonths, t]
  );

  const projectionTotalNet = useMemo(
    () => projection?.nextMonths.reduce((s, m) => s + Number(m.projectedNet), 0) ?? 0,
    [projection]
  );

  const renderCategoryBreakdown = useCallback(
    (items: CategoryBreakdownItem[]) => (
      <FinanceDonutChart slices={items} emptyLabel="—" />
    ),
    []
  );

  const pending = queries.some((q) => q.isPending) || reportQ.isPending;
  const refreshing =
    queries.some((q) => q.isRefetching) ||
    reportQ.isRefetching ||
    projectionQ.isRefetching;

  const refetchAll = () => {
    void overviewQ.refetch();
    void txQ.refetch();
    void catQ.refetch();
    void batchesQ.refetch();
    void reportQ.refetch();
    void projectionQ.refetch();
    if (selectedBatchId) void marginQ.refetch();
  };

  if (!clientFeatures.finance) {
    return (
      <FinanceModuleGate>
        <View />
      </FinanceModuleGate>
    );
  }

  if (pending && !overview) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  const errMsg =
    overviewQ.error instanceof Error
      ? overviewQ.error.message
      : txQ.error instanceof Error
        ? txQ.error.message
        : null;

  if (errMsg && !overview) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{errMsg}</Text>
      </View>
    );
  }

  const tabScroll = (children: ReactNode) => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabScrollGrow}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refetchAll}
          tintColor={mobileColors.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <TabContent>{children}</TabContent>
    </ScrollView>
  );

  const reportSpinner = reportQ.isPending ? (
    <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 12 }} />
  ) : null;

  const txListBlock = (
    <>
      <View style={styles.txSectionHead}>
        <Text style={styles.sectionTitle}>{t("financeScreen.recentTx")}</Text>
        <Pressable
          onPress={() => setShowAllTransactions((v) => !v)}
          hitSlop={8}
        >
          <Text style={styles.viewAllLink}>
            {showAllTransactions
              ? t("financeScreen.viewLess")
              : t("financeScreen.viewAll")}
          </Text>
        </Pressable>
      </View>
      <EventList
        layout="embedded"
        data={financeEventItems}
        pageSize={999}
        emptyMessage={t("financeScreen.noTx")}
        renderDetail={renderFinanceTxDetail}
      />
    </>
  );

  return (
    <View style={styles.screenRoot}>
      <TabSelector
        activeTab={financeTab}
        onTabChange={(key) => {
          setFinanceTab(key);
          setShowAllTransactions(false);
        }}
        header={
          <TabScreenHeader>
            {overview?.lowBalanceWarning ? (
              <View style={styles.warnBanner}>
                <Text style={styles.warnText}>{t("financeScreen.lowBalanceBanner")}</Text>
              </View>
            ) : null}
            <View style={styles.insightHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { marginTop: 0, marginBottom: 0, flex: 1, minWidth: 140 }
                ]}
              >
                {t("financeScreen.insights")}
              </Text>
              <View style={styles.insightPeriodChips}>
                <Pressable
                  style={[styles.chip, reportPeriod === "month" && styles.chipOn]}
                  onPress={() => setReportPeriod("month")}
                >
                  <Text style={styles.chipTx}>{t("financeScreen.periodMonth")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, reportPeriod === "year" && styles.chipOn]}
                  onPress={() => setReportPeriod("year")}
                >
                  <Text style={styles.chipTx}>{t("financeScreen.periodYear")}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.reportPeriodNav}>
              <Pressable
                style={styles.reportPeriodNavBtn}
                onPress={() => {
                  if (reportPeriod === "month") {
                    setReportMonth((m) => shiftMonthUtc(m, -1));
                  } else {
                    setReportYear((y) => String(Number(y) - 1));
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={t("financeScreen.reportPeriodPrev")}
              >
                <Text style={styles.reportPeriodNavBtnTx}>◀</Text>
              </Pressable>
              <View style={styles.reportPeriodNavCenter}>
                <Text style={styles.reportPeriodNavMain}>{reportPeriodLabel}</Text>
              </View>
              <Pressable
                style={styles.reportPeriodNavBtn}
                onPress={() => {
                  if (reportPeriod === "month") {
                    setReportMonth((m) => shiftMonthUtc(m, 1));
                  } else {
                    setReportYear((y) => String(Number(y) + 1));
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={t("financeScreen.reportPeriodNext")}
              >
                <Text style={styles.reportPeriodNavBtnTx}>▶</Text>
              </Pressable>
            </View>
          </TabScreenHeader>
        }
        tabs={[
          {
            key: "overview",
            label: t("financeScreen.tabOverview"),
            content: tabScroll(
              <>
                {overview ? (
                  <ScreenSection plain>
                    <View style={styles.kpiRow}>
                      <View style={styles.kpiHalf}>
                        <FinanceKpiCard
                          title={t("financeScreen.balance")}
                          value={formatMoney(overview.balanceAllTime, curCode, curSym)}
                          deltaText={null}
                          sparklineValues={netSeries.length > 1 ? netSeries : undefined}
                          sparklineColor="#F97316"
                          variant="orange"
                        />
                      </View>
                      <View style={styles.kpiHalf}>
                        <FinanceKpiCard
                          title={t("financeScreen.revenuesMonth")}
                          value={formatMoney(overview.month.totalRevenues, curCode, curSym)}
                          deltaText={revDelta}
                          sparklineValues={revSeries.length > 1 ? revSeries : undefined}
                          sparklineColor="#3B82F6"
                          variant="blue"
                        />
                      </View>
                    </View>
                    <View style={[styles.kpiRow, styles.kpiRowSp]}>
                      <View style={styles.kpiHalf}>
                        <FinanceKpiCard
                          title={t("financeScreen.expensesMonth")}
                          value={formatMoney(overview.month.totalExpenses, curCode, curSym)}
                          deltaText={expDelta}
                          sparklineValues={expSeries.length > 1 ? expSeries : undefined}
                          sparklineColor="#EAB308"
                          variant="yellow"
                        />
                      </View>
                      <View style={styles.kpiHalf}>
                        <FinanceKpiCard
                          title={t("financeScreen.marginMonth")}
                          value={formatMoney(overview.month.netMargin, curCode, curSym)}
                          deltaText={marginDelta}
                          sparklineValues={netSeries.length > 1 ? netSeries : undefined}
                          sparklineColor="#22C55E"
                          variant="green"
                        />
                      </View>
                    </View>
                  </ScreenSection>
                ) : null}
                {overview ? (
                  <ModuleAIInsights
                    farmId={farmId}
                    module="finance"
                    accessToken={accessToken}
                    activeProfileId={activeProfileId}
                    enabled={clientFeatures.finance}
                  />
                ) : null}
                {showBudgetVsExpenseChart ? (
                  <ScreenSection title={t("financeScreen.expensesVsBudget")}>
                    <Text style={styles.budgetSummary}>
                      {t("financeScreen.budgetMonthLine", {
                        spent: formatMoney(
                          selectedPeriodExpenses,
                          curCode,
                          curSym
                        ),
                        budget: formatMoney(monthlyBudget, curCode, curSym),
                        pct: budgetUsedPct ?? 0
                      })}
                    </Text>
                    <SmartChart
                      lines={budgetVsExpenseLines(
                        budgetChartSeries,
                        monthlyBudget,
                        t("financeScreen.legendExpenses"),
                        t("financeScreen.legendBudget")
                      )}
                      period={chartPeriod}
                      onPeriodChange={setChartPeriod}
                      formatValue={chartFmt}
                      monthLabel={(iso) => monthShort(iso, localeStr)}
                      unit={curSym}
                    />
                  </ScreenSection>
                ) : null}
                {months6.length > 0 ? (
                  <ScreenSection title={t("financeScreen.trend6Months")}>
                    <SmartChart
                      lines={revExpChartLines}
                      period={chartPeriod}
                      onPeriodChange={setChartPeriod}
                      formatValue={chartFmt}
                      monthLabel={(iso) => monthShort(iso, localeStr)}
                      unit={curSym}
                    />
                  </ScreenSection>
                ) : null}

                <ScreenSection title={t("financeScreen.marginByBand")}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(batchesQ.data ?? []).map((b) => (
                    <Pressable
                      key={b.id}
                      style={[
                        styles.batchChip,
                        selectedBatchId === b.id && styles.batchChipOn
                      ]}
                      onPress={() => setSelectedBatchId(b.id)}
                    >
                      <Text style={styles.batchChipTx}>{b.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {selectedBatchId && marginQ.data ? (
                  <View style={styles.marginBox}>
                    <Text style={styles.rowMeta}>
                      {t("financeScreen.marginRev")}{" "}
                      {formatMoney(marginQ.data.revenues, curCode, curSym)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {t("financeScreen.marginExpAlloc")}{" "}
                      {formatMoney(marginQ.data.expensesAllocated, curCode, curSym)}
                    </Text>
                    <Text style={styles.rowAmount}>
                      {t("financeScreen.marginGross")}{" "}
                      {formatMoney(marginQ.data.grossMargin, curCode, curSym)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {t("financeScreen.marginPerHead")}{" "}
                      {formatMoney(marginQ.data.costPerHead, curCode, curSym)}
                    </Text>
                    {marginQ.data.costPerKg != null ? (
                      <Text style={styles.rowMeta}>
                        {t("financeScreen.marginPerKg")}{" "}
                        {formatMoney(marginQ.data.costPerKg, curCode, curSym)}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.muted}>{t("financeScreen.selectBand")}</Text>
                )}
                </ScreenSection>

                {projectionQ.isPending ? (
                  <ActivityIndicator
                    color={mobileColors.accent}
                    style={{ marginVertical: 12 }}
                  />
                ) : projection ? (
                  <>
                    {projection.deficitAlert ? (
                      <ScreenSection>
                        <View style={styles.warnBanner}>
                          <Text style={styles.warnText}>
                            {t("financeScreen.deficitBanner")}
                          </Text>
                        </View>
                      </ScreenSection>
                    ) : null}
                    <ScreenSection title={t("financeScreen.projRevExpSplit")}>
                      <SmartChart
                        lines={projectionRevExpLines}
                        formatValue={chartFmt}
                        monthLabel={(m) => m}
                        unit={curSym}
                        summaryStats={[
                          {
                            label: t("financeScreen.projNet"),
                            value: projectionTotalNet
                          }
                        ]}
                      />
                    </ScreenSection>
                    <ScreenSection title={t("financeScreen.projNetTrend")}>
                      <SmartChart
                        lines={projectionNetLines}
                        formatValue={chartFmt}
                        monthLabel={(m) => m}
                        unit={curSym}
                      />
                    </ScreenSection>
                    <ScreenSection title={t("financeScreen.projections")}>
                      {projection.nextMonths.map((m) => {
                        const net = Number(m.projectedNet);
                        return (
                          <View key={m.monthOffset} style={styles.projMonthRow}>
                            <Text style={styles.projMonthLabel}>M+{m.monthOffset}</Text>
                            <View style={styles.projMonthVals}>
                              <Text
                                style={[
                                  styles.projMonthVal,
                                  { color: mobileColors.success }
                                ]}
                              >
                                +
                                {formatMoney(
                                  m.projectedRevenues,
                                  projection.currency,
                                  curSym
                                )}
                              </Text>
                              <Text
                                style={[styles.projMonthVal, { color: mobileColors.error }]}
                              >
                                −
                                {formatMoney(
                                  m.projectedExpenses,
                                  projection.currency,
                                  curSym
                                )}
                              </Text>
                              <Text
                                style={[
                                  styles.projMonthVal,
                                  styles.projMonthNet,
                                  {
                                    color:
                                      net >= 0
                                        ? mobileColors.accent
                                        : mobileColors.error
                                  }
                                ]}
                              >
                                ={" "}
                                {formatMoney(m.projectedNet, projection.currency, curSym)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </ScreenSection>
                  </>
                ) : null}
              </>
            )
          },
          {
            key: "revenus",
            label: t("financeScreen.tabRevenues"),
            content: tabScroll(
              <>
                {reportSpinner}
                <ScreenSection title={t("financeScreen.trendRevenues")}>
              <SmartChart
                lines={financeMonthsToSingleLine(
                  chartMonths,
                  "revenues",
                  t("financeScreen.tabRevenues"),
                  mobileColors.success,
                  (m) => Number(m.revenues ?? 0)
                )}
                period={chartPeriod}
                onPeriodChange={setChartPeriod}
                formatValue={chartFmt}
                monthLabel={(iso) => monthShort(iso, localeStr)}
                unit={curSym}
              />
                </ScreenSection>
                <ScreenSection title={t("financeScreen.sourcesRevenues")}>
              {renderCategoryBreakdown(donutRevenues)}
                </ScreenSection>
                {txListBlock}
              </>
            )
          },
          {
            key: "depenses",
            label: t("financeScreen.tabExpenses"),
            content: tabScroll(
              <>
                {reportSpinner}
                <ScreenSection title={t("financeScreen.trendExpenses")}>
              <SmartChart
                lines={financeMonthsToSingleLine(
                  chartMonths,
                  "expenses",
                  t("financeScreen.tabExpenses"),
                  mobileColors.error,
                  (m) => Number(m.expenses ?? 0)
                )}
                period={chartPeriod}
                onPeriodChange={setChartPeriod}
                formatValue={chartFmt}
                monthLabel={(iso) => monthShort(iso, localeStr)}
                unit={curSym}
              />
                </ScreenSection>
                <ScreenSection title={t("financeScreen.sourcesExpenses")}>
              {renderCategoryBreakdown(donutExpenses)}
                </ScreenSection>
                {txListBlock}
              </>
            )
          },
          {
            key: "budget",
            label: t("financeScreen.tabBudget"),
            content: tabScroll(
              accessToken ? (
                <BudgetScreen
                  farmId={farmId}
                  accessToken={accessToken}
                  activeProfileId={activeProfileId}
                />
              ) : null
            )
          }
        ]}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  screenRoot: { flex: 1, position: "relative", backgroundColor: mobileColors.canvas },
  tabScroll: { flex: 1 },
  tabScrollGrow: { flexGrow: 1 },
  miniChartBox: { alignItems: "center", marginBottom: mobileSpacing.sm },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.md,
    marginTop: mobileSpacing.sm
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm,
    gap: mobileSpacing.xs
  },
  monthLab: {
    ...mobileTypography.meta,
    flex: 1,
    textAlign: "center",
    color: mobileColors.textSecondary,
    fontSize: 11
  },
  budgetSummary: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm,
    fontWeight: "600"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.canvas
  },
  error: { color: mobileColors.error, ...mobileTypography.body },
  farmHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  sp: { marginTop: mobileSpacing.xl },
  muted: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  warnBanner: {
    backgroundColor: "rgba(227, 160, 8, 0.12)",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.warning
  },
  warnText: { color: mobileColors.textPrimary, fontWeight: "600" },
  kpiRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    alignItems: "stretch",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden"
  },
  kpiRowSp: { marginTop: mobileSpacing.sm },
  kpiHalf: {
    flex: 1,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    alignSelf: "stretch",
    overflow: "hidden"
  },
  insightHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.md
  },
  reportPeriodNav: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  reportPeriodNavBtn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs
  },
  reportPeriodNavBtnTx: {
    fontSize: 18,
    color: mobileColors.accent,
    fontWeight: "800"
  },
  reportPeriodNavCenter: { flex: 1, alignItems: "center" },
  reportPeriodNavMain: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center"
  },
  insightPeriodChips: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    flexWrap: "wrap"
  },
  insightPanel: { marginBottom: mobileSpacing.md },
  panelHeading: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  panelHeadingSp: { marginTop: mobileSpacing.lg },
  chartCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  netLine: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  txSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm
  },
  viewAllLink: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  rowAmount: { fontSize: 16, fontWeight: "800", color: mobileColors.textPrimary },
  rowMeta: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  rowEdit: { color: mobileColors.accent, fontWeight: "700" },
  rowDelete: { color: mobileColors.error, fontWeight: "700" },
  lineItem: { fontSize: 14, color: mobileColors.textPrimary, marginBottom: 4 },
  rowBtns: { flexDirection: "row", gap: mobileSpacing.sm, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  chipOn: { backgroundColor: mobileColors.accentSoft },
  chipTx: { fontWeight: "700", color: mobileColors.textPrimary },
  stackRow: { marginBottom: mobileSpacing.sm },
  stackLab: { fontSize: 13, marginBottom: 4, color: mobileColors.textPrimary },
  stackBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: mobileRadius.sm,
    overflow: "hidden"
  },
  stackExp: { backgroundColor: mobileColors.error },
  stackRev: { backgroundColor: mobileColors.success },
  batchChip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    marginRight: mobileSpacing.sm
  },
  batchChipOn: { backgroundColor: mobileColors.accentSoft },
  batchChipTx: { fontWeight: "600", color: mobileColors.textPrimary },
  marginBox: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  primaryBtnTx: { color: "#fff", fontWeight: "800" },
  headerBtn: { marginRight: mobileSpacing.sm },
  headerBtnText: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: 15
  },
  // ── Projections ─────────────────────────────────────────────────────────
  projMonthRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    gap: mobileSpacing.md
  },
  projMonthLabel: {
    ...mobileTypography.meta,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    minWidth: 36
  },
  projMonthVals: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  projMonthVal: {
    ...mobileTypography.meta,
    fontWeight: "600"
  },
  projMonthNet: {
    fontWeight: "800"
  }
});
