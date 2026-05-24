import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { FarmBudgetViewDto } from "../../../lib/api";
import {
  simulateFarmBudget,
  updateFarmBudgetLine,
  upsertFarmBudget
} from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { formatBudgetMoney, globalStatusKey } from "./budgetUtils";
import { isOfflineQueuedResult, useOfflineMutation } from "../../../hooks/useOfflineMutation";
import { BUDGET_INVALIDATE_ROOTS } from "../../../lib/offline/budgetOffline";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  year: number;
  month: number;
  budget: FarmBudgetViewDto;
  onApplied: () => void;
};

export function SimulationTool({
  farmId,
  accessToken,
  activeProfileId,
  year,
  month,
  budget,
  onApplied
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const expenseLines = useMemo(
    () => budget.lines.filter((l) => Number(l.amountPlanned) >= 0),
    [budget.lines]
  );
  const [categoryId, setCategoryId] = useState(expenseLines[0]?.categoryId ?? "");
  const selected = expenseLines.find((l) => l.categoryId === categoryId);
  const [draftAmount, setDraftAmount] = useState(
    selected ? String(Math.round(Number(selected.amountPlanned))) : "0"
  );

  useEffect(() => {
    if (selected) {
      setDraftAmount(String(Math.round(Number(selected.amountPlanned))));
    }
  }, [categoryId, selected?.amountPlanned]);

  const simQ = useMutation({
    mutationFn: () => {
      const n = Number.parseFloat(draftAmount.replace(",", "."));
      if (!categoryId || !Number.isFinite(n)) {
        throw new Error("invalid");
      }
      return simulateFarmBudget(
        accessToken,
        farmId,
        year,
        month,
        categoryId,
        n,
        activeProfileId
      );
    }
  });

  useEffect(() => {
    const tmr = setTimeout(() => {
      if (categoryId && draftAmount) {
        simQ.mutate();
      }
    }, 350);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, draftAmount, year, month]);

  const applyMut = useOfflineMutation({
    farmId,
    type: "budget.simulationApply",
    label: t("budgetScreen.simApply"),
    mutationFn: async () => {
      const n = Number.parseFloat(draftAmount.replace(",", "."));
      if (!categoryId || !Number.isFinite(n)) {
        throw new Error("invalid");
      }
      const line = budget.lines.find((l) => l.categoryId === categoryId);
      if (line?.budgetLineId) {
        return updateFarmBudgetLine(
          accessToken,
          farmId,
          line.budgetLineId,
          n,
          activeProfileId
        );
      }
      const lines = budget.lines.map((l) => ({
        categoryId: l.categoryId,
        amountPlanned:
          l.categoryId === categoryId
            ? n
            : Number.parseFloat(l.amountPlanned) || 0
      }));
      return upsertFarmBudget(
        accessToken,
        farmId,
        { year, month, lines },
        activeProfileId
      );
    },
    buildOfflineItem: () => {
      const n = Number.parseFloat(draftAmount.replace(",", "."));
      if (!categoryId || !Number.isFinite(n)) {
        throw new Error("invalid");
      }
      const line = budget.lines.find((l) => l.categoryId === categoryId);
      if (line?.budgetLineId) {
        return {
          calls: [
            {
              method: "PUT",
              path: `/farms/${farmId}/finance/budget-lines/${line.budgetLineId}`,
              body: { amountPlanned: n }
            }
          ],
          invalidateRoots: [...BUDGET_INVALIDATE_ROOTS]
        };
      }
      return {
        calls: [
          {
            method: "POST",
            path: `/farms/${farmId}/finance/budget`,
            body: {
              year,
              month,
              lines: budget.lines.map((l) => ({
                categoryId: l.categoryId,
                amountPlanned:
                  l.categoryId === categoryId
                    ? n
                    : Number.parseFloat(l.amountPlanned) || 0
              }))
            }
          }
        ],
        invalidateRoots: [...BUDGET_INVALIDATE_ROOTS]
      };
    },
    onSuccess: (data) => {
      if (!isOfflineQueuedResult(data)) {
        onApplied();
      }
    },
    onQueued: () => {
      for (const root of BUDGET_INVALIDATE_ROOTS) {
        void qc.invalidateQueries({ queryKey: [root, farmId] });
      }
      onApplied();
    }
  });

  const sim = simQ.data;
  const cur = budget.currency;
  const sym = budget.currencySymbol;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("budgetScreen.simTitle")}</Text>
      <Text style={styles.sub}>{t("budgetScreen.simSubtitle")}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {expenseLines.map((l) => (
          <Pressable
            key={l.categoryId}
            style={[styles.chip, categoryId === l.categoryId && styles.chipOn]}
            onPress={() => setCategoryId(l.categoryId)}
          >
            <Text
              style={[
                styles.chipTx,
                categoryId === l.categoryId && styles.chipTxOn
              ]}
            >
              {l.categoryIcon ? `${l.categoryIcon} ` : ""}
              {l.categoryName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {selected ? (
        <>
          <Text style={styles.row}>
            {t("budgetScreen.simCurrent")}{" "}
            {formatBudgetMoney(selected.amountPlanned, cur, sym)}
          </Text>
          <Text style={styles.label}>{t("budgetScreen.simNew")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={draftAmount}
            onChangeText={setDraftAmount}
          />
        </>
      ) : null}

      {simQ.isPending ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 8 }} />
      ) : sim ? (
        <View style={styles.impact}>
          <Text style={styles.impactTitle}>{t("budgetScreen.simImpact")}</Text>
          <Text style={styles.impactRow}>
            {t("budgetScreen.simTotal")}{" "}
            {formatBudgetMoney(sim.global.previousTotalPlanned, cur, sym)} →{" "}
            {formatBudgetMoney(sim.global.totalPlanned, cur, sym)}
          </Text>
          <Text style={styles.impactRow}>
            {t("budgetScreen.simMargin")}{" "}
            {formatBudgetMoney(
              String(
                Number(sim.global.previousTotalPlanned) -
                  Number(sim.global.totalRealized)
              ),
              cur,
              sym
            )}{" "}
            → {formatBudgetMoney(sim.global.marginAvailable, cur, sym)}
          </Text>
          <Text style={styles.impactRow}>
            {t("budgetScreen.simStatus")}{" "}
            {t(`budgetScreen.status.${globalStatusKey(sim.global.status)}`)}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => applyMut.mutate()}
          disabled={applyMut.isPending}
        >
          {applyMut.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnPrimaryTx}>{t("budgetScreen.simApply")}</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => {
            if (selected) {
              setDraftAmount(String(Math.round(Number(selected.amountPlanned))));
            }
          }}
        >
          <Text style={styles.btnTx}>{t("budgetScreen.simReset")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  sub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  chips: { flexGrow: 0 },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    marginRight: mobileSpacing.xs
  },
  chipOn: { backgroundColor: mobileColors.accentSoft },
  chipTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  chipTxOn: { color: mobileColors.accent, fontWeight: "600" },
  row: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  impact: {
    gap: mobileSpacing.xs,
    paddingTop: mobileSpacing.sm
  },
  impactTitle: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  impactRow: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  actions: { flexDirection: "row", gap: mobileSpacing.sm, marginTop: mobileSpacing.sm },
  btn: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    backgroundColor: mobileColors.surfaceMuted
  },
  btnPrimary: { backgroundColor: mobileColors.accent },
  btnTx: { ...mobileTypography.body, color: mobileColors.textPrimary },
  btnPrimaryTx: { ...mobileTypography.body, color: "#fff", fontWeight: "600" }
});
