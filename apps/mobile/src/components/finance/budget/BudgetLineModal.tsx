import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import type { FarmBudgetLineDto, FarmBudgetViewDto } from "../../../lib/api";
import {
  fetchFarmBudgetCategoryHistory,
  updateFarmBudgetLine,
  upsertFarmBudget
} from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { budgetShortMonth, formatBudgetMoney } from "./budgetUtils";
import { isOfflineQueuedResult, useOfflineMutation } from "../../../hooks/useOfflineMutation";
import { BUDGET_INVALIDATE_ROOTS } from "../../../lib/offline/budgetOffline";

type Props = {
  visible: boolean;
  onClose: () => void;
  line: FarmBudgetLineDto | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  year: number;
  month: number;
  locale: string;
  allLines: FarmBudgetLineDto[];
  currencySymbol: string;
  onSaved: (view: FarmBudgetViewDto) => void;
};

export function BudgetLineModal({
  visible,
  onClose,
  line,
  farmId,
  accessToken,
  activeProfileId,
  year,
  month,
  locale,
  allLines,
  currencySymbol,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("0");

  useEffect(() => {
    if (line && visible) {
      setAmount(String(Math.round(Number(line.amountPlanned) || 0)));
    }
  }, [line, visible]);

  const histQ = useQuery({
    queryKey: ["budgetCatHist", farmId, line?.categoryId, year, month],
    queryFn: () =>
      fetchFarmBudgetCategoryHistory(
        accessToken,
        farmId,
        line!.categoryId,
        year,
        month,
        activeProfileId
      ),
    enabled: visible && Boolean(line?.categoryId)
  });

  const saveMut = useOfflineMutation({
    farmId,
    type: "budget.updateLine",
    label: line?.categoryName ?? t("budgetScreen.save"),
    mutationFn: async () => {
      const n = Number.parseFloat(amount.replace(",", "."));
      if (!line || !Number.isFinite(n)) {
        throw new Error("invalid");
      }
      if (line.budgetLineId) {
        return updateFarmBudgetLine(
          accessToken,
          farmId,
          line.budgetLineId,
          n,
          activeProfileId
        );
      }
      return upsertFarmBudget(
        accessToken,
        farmId,
        {
          year,
          month,
          lines: allLines.map((l) => ({
            categoryId: l.categoryId,
            amountPlanned:
              l.categoryId === line.categoryId
                ? n
                : Number.parseFloat(l.amountPlanned) || 0
          }))
        },
        activeProfileId
      );
    },
    buildOfflineItem: () => {
      const n = Number.parseFloat(amount.replace(",", "."));
      if (!line || !Number.isFinite(n)) {
        throw new Error("invalid");
      }
      if (line.budgetLineId) {
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
              lines: allLines.map((l) => ({
                categoryId: l.categoryId,
                amountPlanned:
                  l.categoryId === line.categoryId
                    ? n
                    : Number.parseFloat(l.amountPlanned) || 0
              }))
            }
          }
        ],
        invalidateRoots: [...BUDGET_INVALIDATE_ROOTS]
      };
    },
    onSuccess: (view) => {
      if (!isOfflineQueuedResult(view)) {
        onSaved(view as FarmBudgetViewDto);
      }
      onClose();
    },
    onQueued: () => {
      for (const root of BUDGET_INVALIDATE_ROOTS) {
        void qc.invalidateQueries({ queryKey: [root, farmId] });
      }
      onClose();
    }
  });

  if (!line) {
    return null;
  }

  const avg = histQ.data?.averageExpenses;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={line.categoryName}
      headerAmount={formatBudgetMoney(line.amountPlanned, line.currency, currencySymbol)}
      footerPrimary={
        <Pressable
          style={styles.saveBtn}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveTx}>{t("budgetScreen.save")}</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.label}>{t("budgetScreen.newAmount")}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={[styles.label, { marginTop: mobileSpacing.md }]}>
        {t("budgetScreen.historyTitle")}
      </Text>
      {histQ.isPending ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : histQ.data ? (
        <>
          <View style={styles.histRow}>
            {histQ.data.points.map((p) => (
              <Text key={`${p.year}-${p.month}`} style={styles.histCell}>
                {budgetShortMonth(p.year, p.month, locale)}:{" "}
                {formatBudgetMoney(p.expenses, line.currency, currencySymbol)}
              </Text>
            ))}
          </View>
          <Text style={styles.avg}>
            {t("budgetScreen.historyAvg")}{" "}
            {formatBudgetMoney(avg ?? "0", line.currency, currencySymbol)}
          </Text>
          <Pressable
            style={styles.avgBtn}
            onPress={() => {
              if (avg) {
                setAmount(String(Math.round(Number(avg))));
              }
            }}
          >
            <Text style={styles.avgBtnTx}>{t("budgetScreen.applyAverage")}</Text>
          </Pressable>
        </>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.xs,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  histRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  histCell: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary
  },
  avg: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  avgBtn: {
    marginTop: mobileSpacing.sm,
    paddingVertical: mobileSpacing.sm
  },
  avgBtnTx: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  saveBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  saveTx: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "600"
  }
});
