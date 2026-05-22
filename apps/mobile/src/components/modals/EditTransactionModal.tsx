import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { BaseModal } from "./BaseModal";
import { ModalSection } from "./ModalSection";
import { useModal } from "./useModal";
import type { EditTransactionModalPayload } from "../../context/ModalContext";
import { FinanceCategoryGrid } from "../finance/FinanceCategoryGrid";
import { patchFarmExpense, patchFarmRevenue } from "../../lib/api";
import { invalidateFarmFinanceQueries } from "../../lib/invalidateFarmFinanceQueries";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  payload: EditTransactionModalPayload;
  onClose: () => void;
};

function amountToInput(amount: string | number): string {
  if (typeof amount === "number") return String(amount);
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? String(n) : amount;
}

function parseAmount(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function EditTransactionModal({ visible, payload, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { open } = useModal();
  const { transaction: tx } = payload;

  const [txCategoryId, setTxCategoryId] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txLabel, setTxLabel] = useState("");
  const [txDate, setTxDate] = useState("");
  const [txNote, setTxNote] = useState("");

  const txKind = tx.kind;
  const categoryType = txKind === "income" ? "income" : "expense";

  useEffect(() => {
    if (!visible) return;
    setTxAmount(amountToInput(tx.amount));
    setTxLabel(tx.label);
    setTxDate(tx.occurredAt.slice(0, 10));
    setTxNote(tx.note ?? "");
    if (tx.financeCategoryId) {
      setTxCategoryId(tx.financeCategoryId);
      return;
    }
    if (tx.categoryKey) {
      const match = payload.categories.find(
        (c) => c.key === tx.categoryKey && c.type === categoryType
      );
      setTxCategoryId(match?.id ?? "");
      return;
    }
    setTxCategoryId("");
  }, [visible, tx.id, tx.amount, tx.label, tx.occurredAt, tx.note, tx.financeCategoryId, tx.categoryKey, payload.categories, categoryType]);

  const categoriesForType = useMemo(
    () => payload.categories.filter((c) => c.type === categoryType),
    [payload.categories, categoryType]
  );

  const headerAmountPreview =
    txAmount.trim() && Number.isFinite(Number(txAmount.replace(",", ".")))
      ? `${payload.currencySymbol || payload.currencyCode} ${txAmount.trim()}`
      : undefined;

  const statusBadge = useMemo(
    () => ({
      label:
        txKind === "income"
          ? t("financeScreen.income")
          : t("financeScreen.expense"),
      tone: "neutral" as const
    }),
    [txKind, t]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = parseAmount(txAmount);
      if (amount == null) throw new Error(t("financeScreen.invalidAmount"));
      const selected = payload.categories.find((c) => c.id === txCategoryId);
      const categoryValue = selected?.key ?? null;
      const body = {
        amount,
        label: txLabel.trim(),
        category: categoryValue,
        note: txNote.trim() || null,
        occurredAt: `${txDate}T12:00:00.000Z`
      };
      if (txKind === "expense") {
        return patchFarmExpense(
          payload.accessToken,
          payload.farmId,
          tx.id,
          body,
          payload.activeProfileId
        );
      }
      return patchFarmRevenue(
        payload.accessToken,
        payload.farmId,
        tx.id,
        body,
        payload.activeProfileId
      );
    },
    onSuccess: () => {
      invalidateFarmFinanceQueries(qc, payload.farmId);
      onClose();
      setTimeout(() => {
        open("success", {
          message: t("financeScreen.editSuccessMessage"),
          autoDismissMs: 2000
        });
      }, 0);
    },
    onError: (e: Error) =>
      Alert.alert(t("financeScreen.errorTitle"), e.message)
  });

  const submit = () => {
    if (!txLabel.trim() || !txAmount.trim()) {
      Alert.alert(
        t("financeScreen.requiredTitle"),
        t("financeScreen.requiredBody")
      );
      return;
    }
    if (!txDate.trim()) {
      Alert.alert(t("financeScreen.requiredTitle"), t("financeScreen.fieldDate"));
      return;
    }
    saveMutation.mutate();
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("financeScreen.editModalTitle")}
      statusBadge={statusBadge}
      headerAmount={headerAmountPreview}
      footerPrimary={
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.linkTx}>{t("financeScreen.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={submit}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color={mobileColors.accent} />
            ) : (
              <Text style={styles.primaryTx}>{t("financeScreen.save")}</Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <ModalSection title={t("modals.sections.category")}>
        <FinanceCategoryGrid
          categories={categoriesForType}
          selectedId={txCategoryId}
          onSelect={setTxCategoryId}
        />
      </ModalSection>

      <ModalSection title={t("modals.sections.amount")}>
      <Text style={styles.fieldLab}>
        {t("financeScreen.fieldAmount")} ({payload.currencyCode})
      </Text>
      <TextInput
        style={styles.input}
        value={txAmount}
        onChangeText={setTxAmount}
        keyboardType="decimal-pad"
        placeholder={payload.currencySymbol}
      />

      <Text style={styles.fieldLab}>{t("financeScreen.fieldDescription")}</Text>
      <TextInput
        style={styles.input}
        value={txLabel}
        onChangeText={setTxLabel}
        placeholder={t("modals.transaction.descriptionPh")}
      />

      <Text style={styles.fieldLab}>{t("financeScreen.fieldDate")}</Text>
      <TextInput
        style={styles.input}
        value={txDate}
        onChangeText={setTxDate}
        placeholder="YYYY-MM-DD"
      />
      </ModalSection>

      <ModalSection title={t("modals.sections.note")}>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={txNote}
        onChangeText={setTxNote}
        placeholder={t("financeScreen.fieldNotePh")}
        multiline
      />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  fieldLab: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  catScroll: { maxHeight: 160, marginBottom: mobileSpacing.sm },
  catRow: {
    padding: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  catRowOn: { backgroundColor: mobileColors.accentSoft },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.xs,
    color: mobileColors.textPrimary
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  linkTx: {
    color: mobileColors.accent,
    fontWeight: "700"
  },
  primaryTx: {
    color: mobileColors.accent,
    fontWeight: "800",
    fontSize: 16
  }
});
