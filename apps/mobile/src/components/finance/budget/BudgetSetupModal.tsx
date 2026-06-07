import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  applyAutoFarmBudget,
  copyPreviousFarmBudget,
  upsertFarmBudget
} from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { budgetMonthLabel, formatBudgetMoney } from "./budgetUtils";
import { isOfflineQueuedResult, useOfflineMutation } from "../../../hooks/useOfflineMutation";
import { BUDGET_INVALIDATE_ROOTS } from "../../../lib/finance/financeQueryKeys";
import { invalidateBudgetQueries } from "../../../lib/finance/invalidateFinanceQueries";

type Props = {
  visible: boolean;
  onClose: () => void;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  year: number;
  month: number;
  locale: string;
  lines: FarmBudgetLineDto[];
  currency: string;
  currencySymbol: string;
  onSaved: (view: FarmBudgetViewDto) => void;
};

export function BudgetSetupModal({
  visible,
  onClose,
  farmId,
  accessToken,
  activeProfileId,
  year,
  month,
  locale,
  lines,
  currency,
  currencySymbol,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      const init: Record<string, string> = {};
      for (const l of lines) {
        init[l.categoryId] = String(Math.round(Number(l.amountPlanned) || 0));
      }
      setAmounts(init);
    }
  }, [visible, lines]);

  const total = useMemo(() => {
    return Object.values(amounts).reduce((s, v) => {
      const n = Number.parseFloat(v.replace(",", "."));
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [amounts]);

  const buildUpsertBody = () => ({
    year,
    month,
    lines: lines.map((l) => ({
      categoryId: l.categoryId,
      amountPlanned:
        Number.parseFloat((amounts[l.categoryId] ?? "0").replace(",", ".")) || 0
    }))
  });

  const afterBudgetQueued = () => {
    invalidateBudgetQueries(qc, farmId);
    onClose();
  };

  const saveMut = useOfflineMutation({
    farmId,
    type: "budget.upsert",
    label: t("budgetScreen.setupTitle"),
    mutationFn: async () =>
      upsertFarmBudget(accessToken, farmId, buildUpsertBody(), activeProfileId),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/finance/budget`,
          body: buildUpsertBody()
        }
      ],
      invalidateRoots: [...BUDGET_INVALIDATE_ROOTS]
    }),
    onSuccess: (view) => {
      if (!isOfflineQueuedResult(view)) {
        onSaved(view as FarmBudgetViewDto);
      }
      onClose();
    },
    onQueued: afterBudgetQueued
  });

  const copyMut = useOfflineMutation({
    farmId,
    type: "budget.copyPrevious",
    label: t("budgetScreen.copyPrevious"),
    mutationFn: async () =>
      copyPreviousFarmBudget(accessToken, farmId, year, month, activeProfileId),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/finance/budget/copy-previous?year=${year}&month=${month}`,
          body: {}
        }
      ],
      invalidateRoots: [...BUDGET_INVALIDATE_ROOTS]
    }),
    onSuccess: (view) => {
      if (!isOfflineQueuedResult(view)) {
        onSaved(view as FarmBudgetViewDto);
      }
      onClose();
    },
    onQueued: afterBudgetQueued
  });

  const autoMut = useOfflineMutation({
    farmId,
    type: "budget.applyAuto",
    label: t("budgetScreen.applyAuto"),
    mutationFn: async () =>
      applyAutoFarmBudget(accessToken, farmId, year, month, activeProfileId),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/finance/budget/suggestion-auto?year=${year}&month=${month}`,
          body: {}
        }
      ],
      invalidateRoots: [...BUDGET_INVALIDATE_ROOTS]
    }),
    onSuccess: (view) => {
      if (!isOfflineQueuedResult(view)) {
        onSaved(view as FarmBudgetViewDto);
      }
      onClose();
    },
    onQueued: afterBudgetQueued
  });

  const busy = saveMut.isPending || copyMut.isPending || autoMut.isPending;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("budgetScreen.setupTitle")}
      headerAmount={budgetMonthLabel(year, month, locale)}
      footerPrimary={
        <Pressable
          style={styles.saveBtn}
          onPress={() => saveMut.mutate()}
          disabled={busy}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveTx}>{t("budgetScreen.save")}</Text>
          )}
        </Pressable>
      }
    >
      <Pressable
        style={styles.option}
        onPress={() => copyMut.mutate()}
        disabled={busy}
      >
        <Text style={styles.optionTx}>{t("budgetScreen.copyPrevious")}</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => autoMut.mutate()}
        disabled={busy}
      >
        <Text style={styles.optionTx}>{t("budgetScreen.applyAuto")}</Text>
      </Pressable>

      {lines.map((l) => (
        <View key={l.categoryId} style={styles.lineRow}>
          <Text style={styles.lineName} numberOfLines={1}>
            {l.categoryIcon ? `${l.categoryIcon} ` : ""}
            {l.categoryName}
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amounts[l.categoryId] ?? ""}
            onChangeText={(v) =>
              setAmounts((prev) => ({ ...prev, [l.categoryId]: v }))
            }
          />
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t("budgetScreen.total")}</Text>
        <Text style={styles.totalVal}>
          {formatBudgetMoney(total, currency, currencySymbol)}
        </Text>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  option: {
    paddingVertical: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  optionTx: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  lineName: {
    ...mobileTypography.body,
    flex: 1,
    color: mobileColors.textPrimary
  },
  input: {
    width: 120,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    textAlign: "right",
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  totalLabel: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  totalVal: {
    ...mobileTypography.cardTitle,
    color: mobileColors.accent
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
