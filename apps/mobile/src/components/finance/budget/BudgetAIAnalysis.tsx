import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  applyBudgetAiRecommendations,
  fetchBudgetAiAnalysis,
  type BudgetAiRecommendation
} from "../../../lib/api";
import { invalidateBudgetQueries } from "../../../lib/finance/invalidateFinanceQueries";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { formatBudgetMoney } from "./budgetUtils";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  year: number;
  month: number;
  currencySymbol: string;
  onApplied: () => void;
};

export function BudgetAIAnalysis({
  farmId,
  accessToken,
  activeProfileId,
  year,
  month,
  currencySymbol,
  onApplied
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const analysisQ = useQuery({
    queryKey: ["budgetAi", farmId, year, month, activeProfileId],
    queryFn: () =>
      fetchBudgetAiAnalysis(accessToken, farmId, year, month, activeProfileId)
  });

  const recs = analysisQ.data?.recommendations ?? [];

  const toggle = (categoryId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const applyMut = useMutation({
    mutationFn: (items: Array<{ categoryId: string; suggestedBudget: number }>) =>
      applyBudgetAiRecommendations(
        accessToken,
        farmId,
        year,
        month,
        items,
        activeProfileId
      ),
    onSuccess: () => {
      invalidateBudgetQueries(qc, farmId);
      onApplied();
    }
  });

  const selectedItems = useMemo(
    () =>
      recs
        .filter((r) => selected.has(r.categoryId))
        .map((r) => ({
          categoryId: r.categoryId,
          suggestedBudget: r.suggestedBudget
        })),
    [recs, selected]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("budgetScreen.aiTitle")}</Text>
      <Text style={styles.sub}>{t("budgetScreen.aiSubtitle")}</Text>

      {analysisQ.isPending ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 12 }} />
      ) : null}

      {analysisQ.data?.analysis ? (
        <View style={styles.analysisCard}>
          <Text style={styles.analysisTx}>{analysisQ.data.analysis}</Text>
          {analysisQ.data.aiPowered ? (
            <Text style={styles.aiBadge}>✨ IA</Text>
          ) : null}
        </View>
      ) : null}

      {recs.map((r: BudgetAiRecommendation) => (
        <Pressable
          key={r.categoryId}
          style={[styles.recCard, selected.has(r.categoryId) && styles.recOn]}
          onPress={() => toggle(r.categoryId)}
        >
          <Text style={styles.recTitle}>{r.categoryName}</Text>
          <Text style={styles.recLine}>
            {t("budgetScreen.aiCurrent")}:{" "}
            {formatBudgetMoney(r.currentBudget, currencySymbol)} →{" "}
            {formatBudgetMoney(r.suggestedBudget, currencySymbol)}
          </Text>
          <Text style={styles.recSave}>
            {t("budgetScreen.aiSavings", {
              amount: formatBudgetMoney(r.savings, currencySymbol)
            })}
          </Text>
          <Text style={styles.recAction}>{r.action}</Text>
        </Pressable>
      ))}

      <View style={styles.actions}>
        <Pressable
          style={styles.refreshBtn}
          onPress={() => void analysisQ.refetch()}
        >
          <Text style={styles.refreshTx}>{t("budgetScreen.aiRefresh")}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.applyBtn,
            (selectedItems.length === 0 || applyMut.isPending) && styles.disabled
          ]}
          disabled={selectedItems.length === 0 || applyMut.isPending}
          onPress={() => applyMut.mutate(selectedItems)}
        >
          {applyMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.applyTx}>{t("budgetScreen.aiApply")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: mobileSpacing.lg, gap: mobileSpacing.sm },
  title: { ...mobileTypography.sectionTitle, color: mobileColors.textPrimary },
  sub: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  analysisCard: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md
  },
  analysisTx: { ...mobileTypography.body, color: mobileColors.textPrimary },
  aiBadge: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.accent
  },
  recCard: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background
  },
  recOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  recTitle: { fontWeight: "700", color: mobileColors.textPrimary },
  recLine: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  recSave: { color: mobileColors.success, fontWeight: "600", marginTop: 4 },
  recAction: { ...mobileTypography.meta, marginTop: 6 },
  actions: { flexDirection: "row", gap: mobileSpacing.sm, marginTop: 8 },
  refreshBtn: {
    flex: 1,
    padding: 12,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center"
  },
  refreshTx: { fontWeight: "600", color: mobileColors.textPrimary },
  applyBtn: {
    flex: 1,
    padding: 12,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accent,
    alignItems: "center"
  },
  applyTx: { fontWeight: "700", color: "#fff" },
  disabled: { opacity: 0.5 }
});
