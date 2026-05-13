import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  FinanceBarChart,
  type FinanceBarDatum,
  FinanceDonutChart,
  type FinanceDonutSegment,
  FinanceKpiCard
} from "../components/finance";
import { FinanceModuleGate } from "../components/FinanceModuleGate";
import { ProducerEventsFab } from "../components/producer/ProducerEventsFab";
import { useSession } from "../context/SessionContext";
import { isDemoBypassToken } from "../lib/demoBypass";
import { getSupabase } from "../lib/supabase";
import { uploadFinanceProofToSupabase } from "../lib/uploadFinanceProofToSupabase";
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
  fetchFinanceCategories,
  fetchFinanceMarginByBatch,
  fetchFinanceOverview,
  fetchFinanceProjection,
  fetchFinanceReport,
  fetchFinanceSimulation,
  fetchFinanceTransactions,
  postFinanceTransaction
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FarmFinance">;

type InsightTab = "revenus" | "depenses" | "budget";

const DONUT_PALETTE = [
  mobileColors.accent,
  mobileColors.success,
  mobileColors.warning,
  mobileColors.error,
  "#5C6B7A",
  "#2D6A4F"
] as const;

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

function currentYearUtc(): string {
  return String(new Date().getUTCFullYear());
}

export function FarmFinanceScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures, authMe } = useSession();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const localeStr = i18n.language === "en" ? "en-US" : "fr-FR";

  const [reportPeriod, setReportPeriod] = useState<"month" | "year">("month");
  const [reportMonth] = useState(() => currentMonthUtc());
  const [reportYear] = useState(() => currentYearUtc());
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [simHeads, setSimHeads] = useState("10");
  const [simPrice, setSimPrice] = useState("50000");

  const [modalOpen, setModalOpen] = useState(false);
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [txCategoryId, setTxCategoryId] = useState<string>("");
  const [txAmount, setTxAmount] = useState("");
  const [txLabel, setTxLabel] = useState("");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txRef, setTxRef] = useState("");
  const [proofPhotoUri, setProofPhotoUri] = useState<string | null>(null);

  const [insightTab, setInsightTab] = useState<InsightTab>("revenus");
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

  const simMutation = useMutation({
    mutationFn: () =>
      fetchFinanceSimulation(
        accessToken!,
        farmId,
        Number(String(simHeads).replace(",", ".")),
        Number(String(simPrice).replace(",", ".")),
        activeProfileId
      ),
    onError: (e: Error) => Alert.alert("Simulation", e.message)
  });

  const postTx = useMutation({
    mutationFn: async () => {
      const note = t("financeScreen.noteRef", { ref: txRef });
      let attachmentUrl: string | undefined;
      if (proofPhotoUri) {
        if (!isDemoBypassToken(accessToken!)) {
          const supabase = getSupabase();
          if (!supabase) {
            throw new Error(t("financeScreen.proofNoSupabase"));
          }
          const mime =
            proofPhotoUri.toLowerCase().endsWith(".png") ||
            proofPhotoUri.includes("png")
              ? "image/png"
              : "image/jpeg";
          try {
            attachmentUrl = await uploadFinanceProofToSupabase(
              supabase,
              farmId,
              txRef,
              proofPhotoUri,
              mime
            );
          } catch {
            throw new Error(t("financeScreen.proofUploadError"));
          }
        }
      }
      return postFinanceTransaction(
        accessToken!,
        farmId,
        {
          type: txType,
          financeCategoryId: txCategoryId || undefined,
          amount: Number(txAmount.replace(",", ".")),
          label: txLabel.trim(),
          occurredAt: `${txDate}T12:00:00.000Z`,
          attachmentUrl,
          note
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      setModalOpen(false);
      setTxAmount("");
      setTxLabel("");
      setTxCategoryId("");
      setProofPhotoUri(null);
      void qc.invalidateQueries({ queryKey: ["financeOverview", farmId] });
      void qc.invalidateQueries({ queryKey: ["financeTransactions", farmId] });
      void qc.invalidateQueries({ queryKey: ["financeReport", farmId] });
    },
    onError: (e: Error) => Alert.alert(t("financeScreen.errorTitle"), e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (p: { kind: "expense" | "income"; id: string }) => {
      if (p.kind === "expense") {
        await deleteFarmExpense(accessToken!, farmId, p.id, activeProfileId);
      } else {
        await deleteFarmRevenue(accessToken!, farmId, p.id, activeProfileId);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["financeOverview", farmId] });
      void qc.invalidateQueries({ queryKey: ["financeTransactions", farmId] });
      void qc.invalidateQueries({ queryKey: ["financeReport", farmId] });
    },
    onError: (e: Error) => Alert.alert("Suppression impossible", e.message)
  });

  const pickProofPhoto = useCallback(async (source: "library" | "camera") => {
    const perm =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result =
      source === "library"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.82,
            allowsMultipleSelection: false
          })
        : await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!result.canceled && result.assets[0]?.uri) {
      setProofPhotoUri(result.assets[0].uri);
    }
  }, []);

  const openProofMenu = useCallback(() => {
    Alert.alert(t("financeScreen.proofHint"), undefined, [
      { text: t("financeScreen.cancel"), style: "cancel" },
      {
        text: t("producer.pickGallery"),
        onPress: () => void pickProofPhoto("library")
      },
      {
        text: t("producer.pickCamera"),
        onPress: () => void pickProofPhoto("camera")
      }
    ]);
  }, [t, pickProofPhoto]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.finance
        ? () => (
            <TouchableOpacity
              onPress={() => {
                setTxRef(newFarmTransactionRef());
                setProofPhotoUri(null);
                setModalOpen(true);
              }}
              style={styles.headerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>{t("financeScreen.newTx")}</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [navigation, clientFeatures.finance, t]);

  const overview = overviewQ.data as FinanceOverviewDto | undefined;
  const curCode = overview?.settings.currencyCode ?? "XOF";
  const curSym = overview?.settings.currencySymbol ?? "";

  const categories = (catQ.data ?? []) as FinanceCategoryDto[];
  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === txType),
    [categories, txType]
  );

  const transactions = (txQ.data ?? []) as FinanceMergedTransactionDto[];

  const months3 = useMemo(
    () => (overviewQ.data as FinanceOverviewDto | undefined)?.months3 ?? [],
    [overviewQ.data]
  );

  const txSorted = useMemo(
    () =>
      [...transactions].sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      ),
    [transactions]
  );

  const revSeries = useMemo(
    () => months3.map((m) => Number(m.revenues)),
    [months3]
  );
  const expSeries = useMemo(
    () => months3.map((m) => Number(m.expenses)),
    [months3]
  );
  const netSeries = useMemo(
    () => months3.map((m) => Number(m.revenues) - Number(m.expenses)),
    [months3]
  );

  const barsRevenues = useMemo((): FinanceBarDatum[] => {
    const ev = report?.monthlyEvolution;
    if (ev?.length) {
      return ev.map((m) => ({
        label: monthShort(m.month, localeStr),
        value: Number(m.revenues),
        color: mobileColors.success
      }));
    }
    return months3.map((m) => ({
      label: monthShort(m.month, localeStr),
      value: Number(m.revenues),
      color: mobileColors.success
    }));
  }, [report, months3, localeStr]);

  const barsExpenses = useMemo((): FinanceBarDatum[] => {
    const ev = report?.monthlyEvolution;
    if (ev?.length) {
      return ev.map((m) => ({
        label: monthShort(m.month, localeStr),
        value: Number(m.expenses),
        color: mobileColors.error
      }));
    }
    return months3.map((m) => ({
      label: monthShort(m.month, localeStr),
      value: Number(m.expenses),
      color: mobileColors.error
    }));
  }, [report, months3, localeStr]);

  const barsNet = useMemo((): FinanceBarDatum[] => {
    const ev = report?.monthlyEvolution;
    if (ev?.length) {
      return ev.map((m) => ({
        label: monthShort(m.month, localeStr),
        value: Number(m.net),
        color: mobileColors.accent
      }));
    }
    return months3.map((m) => ({
      label: monthShort(m.month, localeStr),
      value: Number(m.revenues) - Number(m.expenses),
      color: mobileColors.accent
    }));
  }, [report, months3, localeStr]);

  const revDelta = useMemo(() => {
    if (months3.length < 2) {
      return null;
    }
    const pct = pctDeltaString(
      Number(months3[months3.length - 1]!.revenues),
      Number(months3[months3.length - 2]!.revenues)
    );
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months3, t]);

  const expDelta = useMemo(() => {
    if (months3.length < 2) {
      return null;
    }
    const pct = pctDeltaString(
      Number(months3[months3.length - 1]!.expenses),
      Number(months3[months3.length - 2]!.expenses)
    );
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months3, t]);

  const marginDelta = useMemo(() => {
    if (months3.length < 2) {
      return null;
    }
    const n1 =
      Number(months3[months3.length - 1]!.revenues) -
      Number(months3[months3.length - 1]!.expenses);
    const n0 =
      Number(months3[months3.length - 2]!.revenues) -
      Number(months3[months3.length - 2]!.expenses);
    const pct = pctDeltaString(n1, n0);
    return pct ? t("financeScreen.vsPrevShort", { pct }) : null;
  }, [months3, t]);

  const donutRevenues = useMemo((): FinanceDonutSegment[] => {
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
      color: DONUT_PALETTE[i % DONUT_PALETTE.length]!
    }));
  }, [report]);

  const donutExpenses = useMemo((): FinanceDonutSegment[] => {
    if (report?.topExpenseCategories?.length) {
      return report.topExpenseCategories.map((c, i) => ({
        label: c.label,
        value: Number(c.expenses),
        display: formatMoney(c.expenses, report.currency, report.currencySymbol),
        color: DONUT_PALETTE[i % DONUT_PALETTE.length]!
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
        color: DONUT_PALETTE[i % DONUT_PALETTE.length]!
      }));
  }, [report]);

  const donutBudget = useMemo((): FinanceDonutSegment[] => {
    const o = overviewQ.data as FinanceOverviewDto | undefined;
    const rev = Number(report?.totals.revenues ?? o?.month.totalRevenues ?? 0);
    const exp = Number(report?.totals.expenses ?? o?.month.totalExpenses ?? 0);
    const cur = report?.currency ?? o?.settings.currencyCode ?? "XOF";
    const sym = report?.currencySymbol ?? o?.settings.currencySymbol;
    return [
      {
        label: t("financeScreen.tabRevenues"),
        value: Math.max(rev, 0),
        display: formatMoney(rev, cur, sym),
        color: mobileColors.success
      },
      {
        label: t("financeScreen.tabExpenses"),
        value: Math.max(exp, 0),
        display: formatMoney(exp, cur, sym),
        color: mobileColors.error
      }
    ];
  }, [report, overviewQ.data, t]);

  const recentForTab = useMemo(() => {
    const limit = showAllTransactions ? 40 : 8;
    const base =
      insightTab === "revenus"
        ? txSorted.filter((x) => x.kind === "income")
        : insightTab === "depenses"
          ? txSorted.filter((x) => x.kind === "expense")
          : txSorted;
    return base.slice(0, limit);
  }, [insightTab, showAllTransactions, txSorted]);

  // ── Données graphiques : Projections ──────────────────────────────────────
  const projectionBarsNet = useMemo((): FinanceBarDatum[] => {
    if (!projection?.nextMonths.length) return [];
    return projection.nextMonths.map((m) => {
      const net = Number(m.projectedNet);
      return {
        label: `M+${m.monthOffset}`,
        value: Math.abs(net),
        color: net >= 0 ? mobileColors.accent : mobileColors.error
      };
    });
  }, [projection]);

  const projectionBarsRevenues = useMemo((): FinanceBarDatum[] => {
    if (!projection?.nextMonths.length) return [];
    return projection.nextMonths.map((m) => ({
      label: `M+${m.monthOffset}`,
      value: Number(m.projectedRevenues),
      color: mobileColors.success
    }));
  }, [projection]);

  const projectionBarsExpenses = useMemo((): FinanceBarDatum[] => {
    if (!projection?.nextMonths.length) return [];
    return projection.nextMonths.map((m) => ({
      label: `M+${m.monthOffset}`,
      value: Number(m.projectedExpenses),
      color: mobileColors.error
    }));
  }, [projection]);

  const projectionDonut = useMemo((): FinanceDonutSegment[] => {
    if (!projection?.nextMonths.length) return [];
    const totalRev = projection.nextMonths.reduce(
      (s, m) => s + Number(m.projectedRevenues),
      0
    );
    const totalExp = projection.nextMonths.reduce(
      (s, m) => s + Number(m.projectedExpenses),
      0
    );
    return [
      {
        label: t("financeScreen.projectedRevenues"),
        value: Math.max(0, totalRev),
        display: formatMoney(totalRev, projection.currency, curSym),
        color: mobileColors.success
      },
      {
        label: t("financeScreen.projectedExpenses"),
        value: Math.max(0, totalExp),
        display: formatMoney(totalExp, projection.currency, curSym),
        color: mobileColors.error
      }
    ];
  }, [projection, curSym, t]);

  const projectionTotalNet = useMemo(
    () => projection?.nextMonths.reduce((s, m) => s + Number(m.projectedNet), 0) ?? 0,
    [projection]
  );

  // ── Données graphiques : Simulation ───────────────────────────────────────
  const simBars = useMemo((): FinanceBarDatum[] => {
    if (!simMutation.data) return [];
    return [
      {
        label: t("financeScreen.simBefore"),
        value: Math.max(0, Number(simMutation.data.currentBalance)),
        color: mobileColors.textSecondary
      },
      {
        label: t("financeScreen.simAdditionalRev"),
        value: Math.max(0, Number(simMutation.data.simulatedAdditionalRevenue)),
        color: mobileColors.success
      },
      {
        label: t("financeScreen.simAfter"),
        value: Math.max(0, Number(simMutation.data.projectedBalance)),
        color: mobileColors.accent
      }
    ];
  }, [simMutation.data, t]);

  const simDonut = useMemo((): FinanceDonutSegment[] => {
    if (!simMutation.data) return [];
    return [
      {
        label: t("financeScreen.simBefore"),
        value: Math.max(0, Number(simMutation.data.currentBalance)),
        display: formatMoney(simMutation.data.currentBalance, curCode, curSym),
        color: mobileColors.accent
      },
      {
        label: t("financeScreen.simAdditionalRev"),
        value: Math.max(0, Number(simMutation.data.simulatedAdditionalRevenue)),
        display: formatMoney(
          simMutation.data.simulatedAdditionalRevenue,
          curCode,
          curSym
        ),
        color: mobileColors.success
      }
    ];
  }, [simMutation.data, curCode, curSym, t]);

  const kpiCardInnerW = Math.max(
    108,
    (windowWidth - mobileSpacing.lg * 2 - mobileSpacing.sm) / 2 -
      mobileSpacing.md * 2
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

  const goEdit = (txRow: FinanceMergedTransactionDto) => {
    if (txRow.kind === "expense") {
      navigation.navigate("EditFarmExpense", {
        farmId,
        farmName,
        expenseId: txRow.id
      });
    } else {
      navigation.navigate("EditFarmRevenue", {
        farmId,
        farmName,
        revenueId: txRow.id
      });
    }
  };

  const confirmDelete = (txRow: FinanceMergedTransactionDto) => {
    Alert.alert(
      "Supprimer ?",
      txRow.label,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate({
              kind: txRow.kind,
              id: txRow.id
            })
        }
      ]
    );
  };

  const isProducer =
    authMe?.profiles.find((p) => p.id === activeProfileId)?.type === "producer";

  return (
    <View style={styles.screenRoot}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetchAll}
            tintColor={mobileColors.accent}
          />
        }
      >
        <Text style={styles.farmHint}>{farmName}</Text>

        {overview?.lowBalanceWarning ? (
          <View style={styles.warnBanner}>
            <Text style={styles.warnText}>{t("financeScreen.lowBalanceBanner")}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t("financeScreen.overview")}</Text>
        {overview ? (
          <View style={styles.kpiRow}>
            <View style={styles.kpiHalf}>
              <FinanceKpiCard
                title={t("financeScreen.balance")}
                value={formatMoney(overview.balanceAllTime, curCode, curSym)}
                deltaText={null}
                sparklineValues={netSeries.length > 1 ? netSeries : undefined}
                sparklineColor="rgba(255,255,255,0.95)"
                variant="dark"
                onLayoutWidth={kpiCardInnerW}
              />
            </View>
            <View style={styles.kpiHalf}>
              <FinanceKpiCard
                title={t("financeScreen.revenuesMonth")}
                value={formatMoney(overview.month.totalRevenues, curCode, curSym)}
                deltaText={revDelta}
                sparklineValues={revSeries.length > 1 ? revSeries : undefined}
                sparklineColor={mobileColors.success}
                variant="income"
                onLayoutWidth={kpiCardInnerW}
              />
            </View>
          </View>
        ) : null}
        {overview ? (
          <View style={[styles.kpiRow, { marginTop: mobileSpacing.sm }]}>
            <View style={styles.kpiHalf}>
              <FinanceKpiCard
                title={t("financeScreen.expensesMonth")}
                value={formatMoney(overview.month.totalExpenses, curCode, curSym)}
                deltaText={expDelta}
                sparklineValues={expSeries.length > 1 ? expSeries : undefined}
                sparklineColor={mobileColors.error}
                variant="expense"
                onLayoutWidth={kpiCardInnerW}
              />
            </View>
            <View style={styles.kpiHalf}>
              <FinanceKpiCard
                title={t("financeScreen.marginMonth")}
                value={formatMoney(overview.month.netMargin, curCode, curSym)}
                deltaText={marginDelta}
                sparklineValues={netSeries.length > 1 ? netSeries : undefined}
                sparklineColor={mobileColors.accent}
                variant="margin"
                onLayoutWidth={kpiCardInnerW}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.insightHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { marginTop: mobileSpacing.sm, marginBottom: 0, flex: 1, minWidth: 140 }
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

        <View style={styles.insightTabRow}>
          {(
            [
              ["revenus", "tabRevenues"],
              ["depenses", "tabExpenses"],
              ["budget", "tabBudget"]
            ] as const
          ).map(([key, i18nKey]) => (
            <Pressable
              key={key}
              onPress={() => {
                setInsightTab(key as InsightTab);
                setShowAllTransactions(false);
              }}
              style={styles.insightTabBtn}
            >
              <Text
                style={[
                  styles.insightTabLabel,
                  insightTab === key && styles.insightTabLabelOn
                ]}
              >
                {t(`financeScreen.${i18nKey}`)}
              </Text>
              {insightTab === key ? <View style={styles.insightTabUnderline} /> : null}
            </Pressable>
          ))}
        </View>

        {reportQ.isPending ? (
          <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 12 }} />
        ) : null}

        {insightTab === "revenus" ? (
          <View style={styles.insightPanel}>
            <Text style={styles.panelHeading}>{t("financeScreen.trendRevenues")}</Text>
            <View style={styles.chartCard}>
              <FinanceBarChart data={barsRevenues} emptyLabel="—" />
            </View>
            <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
              {t("financeScreen.sourcesRevenues")}
            </Text>
            <View style={styles.chartCard}>
              <FinanceDonutChart
                segments={donutRevenues}
                centerTitle={t("financeScreen.tabRevenues")}
                centerValue={
                  report
                    ? formatMoney(
                        report.totals.revenues,
                        report.currency,
                        report.currencySymbol
                      )
                    : overview
                      ? formatMoney(
                          overview.month.totalRevenues,
                          curCode,
                          curSym
                        )
                      : "—"
                }
                emptyLabel="—"
              />
            </View>
          </View>
        ) : null}

        {insightTab === "depenses" ? (
          <View style={styles.insightPanel}>
            <Text style={styles.panelHeading}>{t("financeScreen.trendExpenses")}</Text>
            <View style={styles.chartCard}>
              <FinanceBarChart data={barsExpenses} emptyLabel="—" />
            </View>
            <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
              {t("financeScreen.sourcesExpenses")}
            </Text>
            <View style={styles.chartCard}>
              <FinanceDonutChart
                segments={donutExpenses}
                centerTitle={t("financeScreen.tabExpenses")}
                centerValue={
                  report
                    ? formatMoney(
                        report.totals.expenses,
                        report.currency,
                        report.currencySymbol
                      )
                    : overview
                      ? formatMoney(
                          overview.month.totalExpenses,
                          curCode,
                          curSym
                        )
                      : "—"
                }
                emptyLabel="—"
              />
            </View>
          </View>
        ) : null}

        {insightTab === "budget" ? (
          <View style={styles.insightPanel}>
            <Text style={styles.panelHeading}>{t("financeScreen.trendNet")}</Text>
            <View style={styles.chartCard}>
              <FinanceBarChart data={barsNet} emptyLabel="—" />
            </View>
            <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
              {t("financeScreen.budgetSplit")}
            </Text>
            <View style={styles.chartCard}>
              <FinanceDonutChart
                segments={donutBudget}
                centerTitle={t("financeScreen.tabBudget")}
                centerValue={
                  report
                    ? formatMoney(report.totals.net, report.currency, report.currencySymbol)
                    : overview
                      ? formatMoney(overview.month.netMargin, curCode, curSym)
                      : "—"
                }
                emptyLabel="—"
              />
            </View>
            {report ? (
              <>
                <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
                  {t("financeScreen.catHint")}
                </Text>
                <Text style={styles.netLine}>
                  {t("financeScreen.netLabel")}{" "}
                  {formatMoney(report.totals.net, report.currency, report.currencySymbol)}
                </Text>
                {report.byCategory.map((r) => {
                  const e = Number(r.expenses);
                  const rev = Number(r.revenues);
                  const tw = Math.max(1, e + rev);
                  const ew = (e / tw) * 100;
                  const rw = (rev / tw) * 100;
                  return (
                    <View key={r.key} style={styles.stackRow}>
                      <Text style={styles.stackLab}>{r.label}</Text>
                      <View style={styles.stackBar}>
                        <View style={[styles.stackExp, { width: `${ew}%` }]} />
                        <View style={[styles.stackRev, { width: `${rw}%` }]} />
                      </View>
                    </View>
                  );
                })}
                {report.topExpenseCategories?.length ? (
                  <>
                    <Text style={[styles.subtle, { marginTop: mobileSpacing.md }]}>
                      {t("financeScreen.topExpYear")}
                    </Text>
                    {report.topExpenseCategories.map((c) => (
                      <Text key={c.key} style={styles.lineItem}>
                        {c.label}:{" "}
                        {formatMoney(c.expenses, report.currency, report.currencySymbol)}
                      </Text>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

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

        {recentForTab.length === 0 ? (
          <Text style={styles.muted}>{t("financeScreen.noTx")}</Text>
        ) : (
          recentForTab.map((txRow) => {
            const initials = (txRow.label || "?").trim().slice(0, 1).toUpperCase();
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
            return (
              <View key={`${txRow.kind}-${txRow.id}`} style={styles.txCard}>
                <View style={styles.txRowTop}>
                  <View
                    style={[
                      styles.txAvatar,
                      {
                        backgroundColor:
                          txRow.kind === "income"
                            ? mobileColors.accentSoft
                            : mobileColors.surfaceMuted
                      }
                    ]}
                  >
                    <Text style={styles.txAvatarTx}>{initials}</Text>
                  </View>
                  <View style={styles.txMid}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {txRow.label}
                    </Text>
                    <Text style={styles.txSub} numberOfLines={1}>
                      {txRow.kind === "income"
                        ? t("financeScreen.income")
                        : t("financeScreen.expense")}
                      {txRow.categoryLabel ? ` · ${txRow.categoryLabel}` : ""}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color:
                            txRow.kind === "income"
                              ? mobileColors.success
                              : mobileColors.error
                        }
                      ]}
                    >
                      {signed}
                    </Text>
                    <Text style={styles.txTime}>{timeStr}</Text>
                  </View>
                </View>
                <View style={styles.txRowFoot}>
                  <TouchableOpacity onPress={() => goEdit(txRow)}>
                    <Text style={styles.rowEdit}>{t("financeScreen.editShort")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(txRow)}>
                    <Text style={styles.rowDelete}>{t("financeScreen.deleteShort")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        <Text style={[styles.sectionTitle, styles.sp]}>{t("financeScreen.advancedTitle")}</Text>

        <Text style={styles.panelHeading}>{t("financeScreen.marginByBand")}</Text>
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
              {formatMoney(
                marginQ.data.revenues,
                curCode,
                curSym
              )}
            </Text>
            <Text style={styles.rowMeta}>
              {t("financeScreen.marginExpAlloc")}{" "}
              {formatMoney(
                marginQ.data.expensesAllocated,
                curCode,
                curSym
              )}
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

        <Text style={[styles.sectionTitle, styles.sp]}>
          {t("financeScreen.projections")}
        </Text>
        {projectionQ.isPending ? (
          <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 12 }} />
        ) : projection ? (
          <>
            {projection.deficitAlert ? (
              <View style={styles.warnBanner}>
                <Text style={styles.warnText}>{t("financeScreen.deficitBanner")}</Text>
              </View>
            ) : null}

            {/* Donut : répartition globale revenus / dépenses projetés */}
            <Text style={styles.panelHeading}>{t("financeScreen.projRevExpSplit")}</Text>
            <View style={styles.chartCard}>
              <FinanceDonutChart
                segments={projectionDonut}
                centerTitle={t("financeScreen.projNet")}
                centerValue={formatMoney(projectionTotalNet, projection.currency, curSym)}
                emptyLabel="—"
              />
            </View>

            {/* Barres : trajectoire du résultat net */}
            <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
              {t("financeScreen.projNetTrend")}
            </Text>
            <View style={styles.chartCard}>
              <FinanceBarChart data={projectionBarsNet} emptyLabel="—" />
            </View>

            {/* Barres : revenus projetés */}
            <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
              {t("financeScreen.projectedRevenues")}
            </Text>
            <View style={styles.chartCard}>
              <FinanceBarChart data={projectionBarsRevenues} emptyLabel="—" />
            </View>

            {/* Barres : dépenses projetées */}
            <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
              {t("financeScreen.projectedExpenses")}
            </Text>
            <View style={styles.chartCard}>
              <FinanceBarChart data={projectionBarsExpenses} emptyLabel="—" />
            </View>

            {/* Tableau détail par mois */}
            {projection.nextMonths.map((m) => {
              const net = Number(m.projectedNet);
              return (
                <View key={m.monthOffset} style={styles.projMonthRow}>
                  <Text style={styles.projMonthLabel}>M+{m.monthOffset}</Text>
                  <View style={styles.projMonthVals}>
                    <Text style={[styles.projMonthVal, { color: mobileColors.success }]}>
                      +{formatMoney(m.projectedRevenues, projection.currency, curSym)}
                    </Text>
                    <Text style={[styles.projMonthVal, { color: mobileColors.error }]}>
                      −{formatMoney(m.projectedExpenses, projection.currency, curSym)}
                    </Text>
                    <Text
                      style={[
                        styles.projMonthVal,
                        styles.projMonthNet,
                        { color: net >= 0 ? mobileColors.accent : mobileColors.error }
                      ]}
                    >
                      = {formatMoney(m.projectedNet, projection.currency, curSym)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sp]}>
          {t("financeScreen.simulation")}
        </Text>

        {/* Formulaire de saisie */}
        <View style={styles.simRow}>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={simHeads}
            onChangeText={setSimHeads}
            placeholder={t("financeScreen.simHeadsPh")}
          />
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={simPrice}
            onChangeText={setSimPrice}
            placeholder={t("financeScreen.simPricePh")}
          />
          <TouchableOpacity
            style={styles.simBtn}
            onPress={() => simMutation.mutate()}
            disabled={simMutation.isPending}
          >
            {simMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.simBtnTx}>{t("financeScreen.calc")}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Résultats graphiques */}
        {simMutation.data ? (
          <>
            <Text style={[styles.panelHeading, { marginTop: mobileSpacing.md }]}>
              {t("financeScreen.simResultTitle")}
            </Text>

            {/* Barres : avant / revenus simulés / après */}
            <View style={styles.chartCard}>
              <FinanceBarChart data={simBars} emptyLabel="—" />
            </View>

            {/* Donut : composition du solde projeté */}
            <Text style={[styles.panelHeading, styles.panelHeadingSp]}>
              {t("financeScreen.simComposition")}
            </Text>
            <View style={styles.chartCard}>
              <FinanceDonutChart
                segments={simDonut}
                centerTitle={t("financeScreen.simAfter")}
                centerValue={formatMoney(
                  simMutation.data.projectedBalance,
                  curCode,
                  curSym
                )}
                emptyLabel="—"
              />
            </View>

            {/* Détail chiffré */}
            <View style={styles.simDetailCard}>
              <View style={styles.simDetailRow}>
                <Text style={styles.simDetailLabel}>
                  {t("financeScreen.simBefore")}
                </Text>
                <Text style={styles.simDetailValue}>
                  {formatMoney(simMutation.data.currentBalance, curCode, curSym)}
                </Text>
              </View>
              <View style={styles.simDetailRow}>
                <Text style={styles.simDetailLabel}>
                  {t("financeScreen.simAdditionalRev")}
                </Text>
                <Text style={[styles.simDetailValue, { color: mobileColors.success }]}>
                  +{formatMoney(
                    simMutation.data.simulatedAdditionalRevenue,
                    curCode,
                    curSym
                  )}
                </Text>
              </View>
              <View style={styles.simDetailRowFinal}>
                <Text style={[styles.simDetailLabel, { fontWeight: "800" }]}>
                  {t("financeScreen.simAfter")}
                </Text>
                <Text
                  style={[
                    styles.simDetailValue,
                    { color: mobileColors.accent, fontWeight: "800" }
                  ]}
                >
                  {formatMoney(simMutation.data.projectedBalance, curCode, curSym)}
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <Text style={[styles.subtle, { marginTop: mobileSpacing.lg }]}>
          {t("financeScreen.exportHint")}
        </Text>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("financeScreen.modalTitle")}</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              <Text style={styles.fieldLab}>{t("financeScreen.transactionRef")}</Text>
              <View style={styles.refBox}>
                <Text style={styles.refValue} selectable>
                  {txRef || "—"}
                </Text>
              </View>
              <Text style={styles.refHint}>{t("financeScreen.transactionRefHint")}</Text>

              <View style={styles.rowBtns}>
                <Pressable
                  style={[styles.chip, txType === "expense" && styles.chipOn]}
                  onPress={() => {
                    setTxType("expense");
                    setTxCategoryId("");
                  }}
                >
                  <Text style={styles.chipTx}>{t("financeScreen.expense")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, txType === "income" && styles.chipOn]}
                  onPress={() => {
                    setTxType("income");
                    setTxCategoryId("");
                  }}
                >
                  <Text style={styles.chipTx}>{t("financeScreen.income")}</Text>
                </Pressable>
              </View>
              <Text style={styles.fieldLab}>{t("financeScreen.fieldCategory")}</Text>
              <ScrollView style={styles.catScroll} nestedScrollEnabled>
                {categoriesForType.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.catRow,
                      txCategoryId === c.id && styles.catRowOn
                    ]}
                    onPress={() => setTxCategoryId(c.id)}
                  >
                    <Text>
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.fieldLab}>{t("financeScreen.fieldAmount")}</Text>
              <TextInput
                style={styles.input}
                value={txAmount}
                onChangeText={setTxAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.fieldLab}>{t("financeScreen.fieldDescription")}</Text>
              <TextInput
                style={styles.input}
                value={txLabel}
                onChangeText={setTxLabel}
              />
              <Text style={styles.fieldLab}>{t("financeScreen.fieldDate")}</Text>
              <TextInput style={styles.input} value={txDate} onChangeText={setTxDate} />

              <Text style={styles.fieldLab}>{t("financeScreen.proofHint")}</Text>
              {proofPhotoUri ? (
                <View style={styles.proofPreviewWrap}>
                  <Image
                    source={{ uri: proofPhotoUri }}
                    style={styles.proofPreview}
                    resizeMode="cover"
                  />
                  <View style={styles.proofBtnRow}>
                    <TouchableOpacity onPress={openProofMenu}>
                      <Text style={styles.rowEdit}>
                        {t("financeScreen.changeProofPhoto")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setProofPhotoUri(null)}>
                      <Text style={styles.rowDelete}>
                        {t("financeScreen.removeProofPhoto")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.proofAddBtn}
                  onPress={openProofMenu}
                >
                  <Text style={styles.proofAddBtnTx}>{t("financeScreen.addProofPhoto")}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Text style={styles.rowEdit}>{t("financeScreen.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!txLabel.trim() || !txAmount.trim()) {
                    Alert.alert(
                      t("financeScreen.requiredTitle"),
                      t("financeScreen.requiredBody")
                    );
                    return;
                  }
                  postTx.mutate();
                }}
                disabled={postTx.isPending}
              >
                {postTx.isPending ? (
                  <ActivityIndicator size="small" color={mobileColors.accent} />
                ) : (
                  <Text style={styles.primaryInline}>{t("financeScreen.create")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {isProducer ? (
        <View style={styles.fabLayer} pointerEvents="box-none">
          <ProducerEventsFab
            onPress={() => navigation.navigate("FarmEventsFeed")}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, position: "relative" },
  fabLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    pointerEvents: "box-none"
  },
  scroll: { flex: 1, backgroundColor: mobileColors.surface },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl * 2
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.surface
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
  subtle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
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
  kpiRow: { flexDirection: "row", gap: mobileSpacing.sm },
  kpiHalf: { flex: 1, minWidth: 0 },
  insightHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.md
  },
  insightPeriodChips: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    flexWrap: "wrap"
  },
  insightTabRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  insightTabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: mobileSpacing.sm
  },
  insightTabLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  insightTabLabelOn: {
    color: mobileColors.textPrimary,
    fontWeight: "800"
  },
  insightTabUnderline: {
    marginTop: mobileSpacing.xs,
    height: 3,
    width: "56%",
    borderRadius: 2,
    backgroundColor: mobileColors.accent
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
  txCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  txRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md
  },
  txAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  txAvatarTx: {
    fontSize: 17,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  txMid: { flex: 1, minWidth: 0 },
  txTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  txSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  txRight: { alignItems: "flex-end" },
  txAmount: {
    fontSize: 15,
    fontWeight: "800"
  },
  txTime: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  txRowFoot: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.lg,
    marginTop: mobileSpacing.md,
    paddingTop: mobileSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
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
  simRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm,
    marginVertical: mobileSpacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    minWidth: 120,
    flex: 1,
    color: mobileColors.textPrimary
  },
  simBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.sm,
    paddingHorizontal: mobileSpacing.md,
    justifyContent: "center"
  },
  simBtnTx: { color: "#fff", fontWeight: "700" },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: mobileColors.surface,
    padding: mobileSpacing.lg,
    borderTopLeftRadius: mobileRadius.lg,
    borderTopRightRadius: mobileRadius.lg,
    maxHeight: "92%"
  },
  modalScroll: {
    maxHeight: 420
  },
  refBox: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  refValue: {
    ...mobileTypography.body,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: mobileColors.textPrimary
  },
  refHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs,
    marginBottom: mobileSpacing.sm
  },
  proofPreviewWrap: {
    marginBottom: mobileSpacing.sm
  },
  proofPreview: {
    width: "100%",
    height: 160,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  proofBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  proofAddBtn: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderStyle: "dashed",
    paddingVertical: mobileSpacing.md,
    alignItems: "center",
    marginBottom: mobileSpacing.sm
  },
  proofAddBtnTx: {
    color: mobileColors.accent,
    fontWeight: "700"
  },
  modalTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.md
  },
  fieldLab: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  catScroll: { maxHeight: 160, marginBottom: mobileSpacing.sm },
  catRow: {
    padding: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  catRowOn: { backgroundColor: mobileColors.accentSoft },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.md
  },
  primaryInline: {
    color: mobileColors.accent,
    fontWeight: "800",
    fontSize: 16
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
  },
  // ── Simulation ───────────────────────────────────────────────────────────
  simDetailCard: {
    marginTop: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  simDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: mobileSpacing.xs
  },
  simDetailRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: mobileSpacing.sm,
    marginTop: mobileSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  simDetailLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  simDetailValue: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  }
});
