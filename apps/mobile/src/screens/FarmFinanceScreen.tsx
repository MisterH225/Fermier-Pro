import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { FinanceModuleGate } from "../components/FinanceModuleGate";
import { useSession } from "../context/SessionContext";
import type { FarmExpenseDto, FarmRevenueDto } from "../lib/api";
import {
  deleteFarmExpense,
  deleteFarmRevenue,
  fetchFarmExpenses,
  fetchFarmRevenues,
  fetchFinanceSummary
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmFinance">;

function formatMoney(amount: string | number, currency: string): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.length === 3 ? currency : "XOF",
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

export function FarmFinanceScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (p: { kind: "expense" | "revenue"; id: string }) => {
      if (p.kind === "expense") {
        await deleteFarmExpense(
          accessToken,
          farmId,
          p.id,
          activeProfileId
        );
      } else {
        await deleteFarmRevenue(
          accessToken,
          farmId,
          p.id,
          activeProfileId
        );
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["financeSummary", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmExpenses", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmRevenues", farmId] });
    },
    onError: (e: Error) => {
      Alert.alert("Suppression impossible", e.message);
    }
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.finance
        ? () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("CreateFarmExpense", { farmId, farmName })
                }
                style={styles.headerSecondary}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.headerSecondaryText}>Dépense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("CreateFarmRevenue", { farmId, farmName })
                }
                style={styles.headerSecondary}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.headerSecondaryText}>Revenu</Text>
              </TouchableOpacity>
            </View>
          )
        : undefined
    });
  }, [navigation, farmId, farmName, clientFeatures.finance]);

  const [summaryQ, expensesQ, revenuesQ] = useQueries({
    queries: [
      {
        queryKey: ["financeSummary", farmId, activeProfileId],
        queryFn: () =>
          fetchFinanceSummary(accessToken, farmId, activeProfileId),
        enabled: clientFeatures.finance
      },
      {
        queryKey: ["farmExpenses", farmId, activeProfileId],
        queryFn: () => fetchFarmExpenses(accessToken, farmId, activeProfileId),
        enabled: clientFeatures.finance
      },
      {
        queryKey: ["farmRevenues", farmId, activeProfileId],
        queryFn: () => fetchFarmRevenues(accessToken, farmId, activeProfileId),
        enabled: clientFeatures.finance
      }
    ]
  });

  const pending =
    summaryQ.isPending || expensesQ.isPending || revenuesQ.isPending;
  const refreshing =
    summaryQ.isRefetching || expensesQ.isRefetching || revenuesQ.isRefetching;

  const refetchAll = () => {
    void summaryQ.refetch();
    void expensesQ.refetch();
    void revenuesQ.refetch();
  };

  if (!clientFeatures.finance) {
    return (
      <FinanceModuleGate>
        <View />
      </FinanceModuleGate>
    );
  }

  if (pending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  const errMsg =
    summaryQ.error instanceof Error
      ? summaryQ.error.message
      : expensesQ.error instanceof Error
        ? expensesQ.error.message
        : revenuesQ.error instanceof Error
          ? revenuesQ.error.message
          : null;

  if (errMsg) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{errMsg}</Text>
        <Text style={styles.hint}>
          Scopes requis : finance.read sur cette ferme.
        </Text>
      </View>
    );
  }

  const summary = summaryQ.data;
  const expenses = expensesQ.data ?? [];
  const revenues = revenuesQ.data ?? [];
  const cur = summary?.currency ?? "XOF";

  const goEditExpense = (e: FarmExpenseDto) => {
    navigation.navigate("EditFarmExpense", {
      farmId,
      farmName,
      expenseId: e.id
    });
  };

  const goEditRevenue = (r: FarmRevenueDto) => {
    navigation.navigate("EditFarmRevenue", {
      farmId,
      farmName,
      revenueId: r.id
    });
  };

  const confirmDeleteExpense = (e: FarmExpenseDto) => {
    Alert.alert(
      "Supprimer cette dépense ?",
      e.label,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate({ kind: "expense", id: e.id })
        }
      ]
    );
  };

  const confirmDeleteRevenue = (r: FarmRevenueDto) => {
    Alert.alert(
      "Supprimer ce revenu ?",
      r.label,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate({ kind: "revenue", id: r.id })
        }
      ]
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refetchAll}
          tintColor="#5d7a1f"
        />
      }
    >
      <Text style={styles.farmHint}>{farmName}</Text>

      {summary ? (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardNeutral]}>
            <Text style={styles.summaryLabel}>Charges</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(summary.totalExpenses, cur)}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardNeutral]}>
            <Text style={styles.summaryLabel}>Produits</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(summary.totalRevenues, cur)}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardNet]}>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(summary.net, cur)}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Dépenses récentes</Text>
      {expenses.length === 0 ? (
        <Text style={styles.muted}>Aucune dépense enregistrée.</Text>
      ) : (
        expenses.map((e: FarmExpenseDto) => (
          <View key={e.id} style={styles.rowCard}>
            <Text style={styles.rowAmount}>{formatMoney(e.amount, e.currency)}</Text>
            <Text style={styles.rowLabel}>{e.label}</Text>
            <Text style={styles.rowMeta}>
              {new Date(e.occurredAt).toLocaleDateString("fr-FR")}
              {e.category ? ` · ${e.category}` : ""}
            </Text>
            {e.note ? (
              <Text style={styles.rowNote} numberOfLines={3}>
                {e.note}
              </Text>
            ) : null}
            <View style={styles.rowActions}>
              <TouchableOpacity
                onPress={() => goEditExpense(e)}
                disabled={deleteMutation.isPending}
                style={styles.rowEditHit}
              >
                <Text style={styles.rowEdit}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDeleteExpense(e)}
                disabled={deleteMutation.isPending}
                style={styles.rowDeleteHit}
              >
                <Text style={styles.rowDelete}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, styles.sectionSpacer]}>
        Revenus récents
      </Text>
      {revenues.length === 0 ? (
        <Text style={styles.muted}>Aucun revenu enregistré.</Text>
      ) : (
        revenues.map((r: FarmRevenueDto) => (
          <View key={r.id} style={styles.rowCard}>
            <Text style={styles.rowAmount}>{formatMoney(r.amount, r.currency)}</Text>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowMeta}>
              {new Date(r.occurredAt).toLocaleDateString("fr-FR")}
              {r.category ? ` · ${r.category}` : ""}
            </Text>
            {r.note ? (
              <Text style={styles.rowNote} numberOfLines={3}>
                {r.note}
              </Text>
            ) : null}
            <View style={styles.rowActions}>
              <TouchableOpacity
                onPress={() => goEditRevenue(r)}
                disabled={deleteMutation.isPending}
                style={styles.rowEditHit}
              >
                <Text style={styles.rowEdit}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDeleteRevenue(r)}
                disabled={deleteMutation.isPending}
                style={styles.rowDeleteHit}
              >
                <Text style={styles.rowDelete}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: { color: "#a34c24", textAlign: "center", marginBottom: 8 },
  hint: { fontSize: 13, color: "#6d745b", textAlign: "center" },
  farmHint: {
    fontSize: 13,
    color: "#6d745b",
    marginBottom: 14
  },
  summaryRow: { marginBottom: 20 },
  summaryCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10
  },
  summaryCardNeutral: {
    backgroundColor: "#fff",
    borderColor: "#e8e4d4"
  },
  summaryCardNet: {
    backgroundColor: "#eef4dc",
    borderColor: "#c5d4a3"
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6d745b",
    marginBottom: 6,
    textTransform: "uppercase"
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2910"
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2910",
    marginBottom: 10
  },
  sectionSpacer: { marginTop: 18 },
  muted: { fontSize: 14, color: "#6d745b", marginBottom: 12 },
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8e4d4"
  },
  rowAmount: {
    fontSize: 17,
    fontWeight: "800",
    color: "#5d7a1f",
    marginBottom: 4
  },
  rowLabel: { fontSize: 15, fontWeight: "600", color: "#1f2910" },
  rowMeta: { fontSize: 13, color: "#6d745b", marginTop: 4 },
  rowNote: { fontSize: 14, color: "#4a5238", marginTop: 8, lineHeight: 20 },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10
  },
  rowEditHit: { paddingVertical: 4, marginRight: 20 },
  rowEdit: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5d7a1f"
  },
  rowDeleteHit: { paddingVertical: 4 },
  rowDelete: {
    fontSize: 14,
    fontWeight: "700",
    color: "#a34c24"
  },
  headerActions: { flexDirection: "row", alignItems: "center", marginRight: 4 },
  headerSecondary: { marginLeft: 8 },
  headerSecondaryText: { color: "#fff", fontWeight: "700", fontSize: 14 }
});
