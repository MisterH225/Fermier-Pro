import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const PAYMENT_MODES = [
  "Espèces",
  "Mobile Money",
  "Virement bancaire",
  "Autre"
] as const;

type Props = {
  visible: boolean;
  balanceAmount: number;
  currency: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    amount: number;
    paymentMode: string;
    paymentRef?: string;
  }) => void;
};

export function ConfirmBalancePaymentModal({
  visible,
  balanceAmount,
  currency,
  submitting,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(Math.round(balanceAmount)));
  const [mode, setMode] = useState<string>(PAYMENT_MODES[0]);
  const [ref, setRef] = useState("");
  const amountNum = Number.parseFloat(amount.replace(",", "."));
  const valid = Number.isFinite(amountNum) && amountNum > 0 && mode.trim();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.credit.balance.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.credit.balance.confirm")}
          loading={submitting}
          disabled={!valid}
          onPress={() => {
            if (!valid) return;
            onConfirm({
              amount: amountNum,
              paymentMode: mode,
              paymentRef: ref.trim() || undefined
            });
          }}
        />
      }
    >
      <Text style={styles.label}>{t("marketScreen.credit.balance.amount")}</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={currency}
      />
      <Text style={styles.label}>{t("marketScreen.credit.paymentMode")}</Text>
      <View style={styles.chipRow}>
        {PAYMENT_MODES.map((m) => (
          <Pressable
            key={m}
            style={[styles.chip, mode === m && styles.chipOn]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.chipTx, mode === m && styles.chipTxOn]}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("marketScreen.credit.paymentRef")}</Text>
      <TextInput
        style={styles.input}
        value={ref}
        onChangeText={setRef}
        placeholder={t("marketScreen.credit.paymentRefPh")}
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs,
    marginTop: mobileSpacing.sm
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  chipTx: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  chipTxOn: { color: mobileColors.accent, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    color: mobileColors.textPrimary
  }
});
