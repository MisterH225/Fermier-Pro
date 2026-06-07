import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { formatMarketMoney } from "./MarketplaceListingCard";
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
  advanceAmount: number;
  balanceAmount: number;
  balanceDueDays: number;
  currency: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: { paymentMode: string; paymentRef?: string }) => void;
};

export function ConfirmAdvancePaymentModal({
  visible,
  advanceAmount,
  balanceAmount,
  balanceDueDays,
  currency,
  submitting,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<string>(PAYMENT_MODES[0]);
  const [ref, setRef] = useState("");

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.credit.advance.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.credit.advance.confirm")}
          loading={submitting}
          disabled={!mode.trim()}
          onPress={() =>
            onConfirm({
              paymentMode: mode,
              paymentRef: ref.trim() || undefined
            })
          }
        />
      }
    >
      <Text style={styles.info}>{t("marketScreen.credit.advance.info")}</Text>
      <View style={styles.summary}>
        <Text style={styles.line}>
          {t("marketScreen.credit.advance.due")}:{" "}
          <Text style={styles.bold}>
            {formatMarketMoney(advanceAmount, currency)}
          </Text>
        </Text>
        <Text style={styles.line}>
          {t("marketScreen.credit.advance.balance")}:{" "}
          {formatMarketMoney(balanceAmount, currency)}
        </Text>
        <Text style={styles.line}>
          {t("marketScreen.credit.advance.delay", { count: balanceDueDays })}
        </Text>
      </View>
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
  info: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  summary: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.xs,
    marginBottom: mobileSpacing.md
  },
  line: { ...mobileTypography.body, color: mobileColors.textPrimary },
  bold: { fontWeight: "800" },
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
