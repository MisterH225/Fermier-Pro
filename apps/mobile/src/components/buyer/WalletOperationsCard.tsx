import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  confirmWalletTopUp,
  confirmWalletWithdraw,
  fetchWalletTransferRecipient,
  initiateWalletTopUp,
  initiateWalletWithdraw,
  transferWalletFunds,
  type WalletTransferRecipientDto
} from "../../lib/api";
import { openPaymentCheckout } from "../../lib/paymentCheckout";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography, mobileColors, mobileFontSize } from "../../theme/mobileTheme";

type WalletSection = "topup" | "withdraw" | "transfer" | "all";

type Props = {
  currency: string;
  balance: number;
  visibleSection?: WalletSection;
};

function parseAmount(raw: string): number | null {
  const n = Number.parseInt(raw.replace(/\s/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function WalletOperationsCard({
  currency,
  balance,
  visibleSection = "all"
}: Props) {
  const { t } = useTranslation();
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferPhone, setTransferPhone] = useState("");
  const [transferRecipient, setTransferRecipient] =
    useState<WalletTransferRecipientDto | null>(null);
  const [transferNote, setTransferNote] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["buyerWallet"] });
    void queryClient.invalidateQueries({ queryKey: ["buyerWalletEntries"] });
    void queryClient.invalidateQueries({ queryKey: ["userWallet"] });
    void queryClient.invalidateQueries({ queryKey: ["userWalletEntries"] });
  };

  const topUpMut = useMutation({
    mutationFn: async (amount: number) => {
      const init = await initiateWalletTopUp(accessToken!, amount);
      if (!init.providerRef) {
        throw new Error(t("buyer.wallet.ops.topUpInvalid"));
      }
      if (init.paymentUrl) {
        await openPaymentCheckout(init.paymentUrl);
        return { pendingExternalPayment: true as const };
      }
      return confirmWalletTopUp(accessToken!, init.providerRef);
    },
    onSuccess: (result) => {
      setTopUpAmount("");
      invalidate();
      if (result && "pendingExternalPayment" in result && result.pendingExternalPayment) {
        Alert.alert(
          t("buyer.wallet.ops.topUpPendingTitle"),
          t("buyer.wallet.ops.topUpPendingBody")
        );
        return;
      }
      Alert.alert(t("buyer.wallet.ops.topUpSuccessTitle"), t("buyer.wallet.ops.topUpSuccessBody"));
    },
    onError: (e: Error) => Alert.alert(t("common.error"), e.message)
  });

  const withdrawMut = useMutation({
    mutationFn: async (payload: { amount: number; phone?: string }) => {
      const init = await initiateWalletWithdraw(
        accessToken!,
        payload.amount,
        payload.phone
      );
      if (init.requiresApproval) {
        return { pendingApproval: true as const, init };
      }
      if (!init.providerRef) {
        throw new Error(t("buyer.wallet.ops.withdrawInvalid"));
      }
      const confirmed = await confirmWalletWithdraw(
        accessToken!,
        payload.amount,
        init.providerRef,
        payload.phone,
        init.withdrawalRequestId
      );
      return { pendingApproval: false as const, confirmed };
    },
    onSuccess: (result) => {
      setWithdrawAmount("");
      setWithdrawPhone("");
      invalidate();
      if (result.pendingApproval) {
        Alert.alert(
          t("buyer.wallet.ops.withdrawPendingTitle"),
          result.init.message ?? t("buyer.wallet.ops.withdrawPendingBody")
        );
        return;
      }
      Alert.alert(
        t("buyer.wallet.ops.withdrawSuccessTitle"),
        t("buyer.wallet.ops.withdrawSuccessBody")
      );
    },
    onError: (e: Error) => Alert.alert(t("common.error"), e.message)
  });

  const lookupRecipientMut = useMutation({
    mutationFn: (phone: string) => fetchWalletTransferRecipient(accessToken!, phone),
    onSuccess: (data) => setTransferRecipient(data),
    onError: (e: Error) => {
      setTransferRecipient(null);
      Alert.alert(t("common.error"), e.message);
    }
  });

  const transferMut = useMutation({
    mutationFn: (payload: {
      amount: number;
      recipientPhone: string;
      note?: string;
    }) =>
      transferWalletFunds(
        accessToken!,
        payload.amount,
        payload.recipientPhone,
        payload.note
      ),
    onSuccess: () => {
      setTransferAmount("");
      setTransferPhone("");
      setTransferRecipient(null);
      setTransferNote("");
      invalidate();
      Alert.alert(
        t("buyer.wallet.ops.transferSuccessTitle"),
        t("buyer.wallet.ops.transferSuccessBody")
      );
    },
    onError: (e: Error) => Alert.alert(t("common.error"), e.message)
  });

  const busy =
    topUpMut.isPending ||
    withdrawMut.isPending ||
    transferMut.isPending ||
    lookupRecipientMut.isPending;

  const showTopUp = visibleSection === "all" || visibleSection === "topup";
  const showWithdraw = visibleSection === "all" || visibleSection === "withdraw";
  const showTransfer = visibleSection === "all" || visibleSection === "transfer";
  const showHeader = visibleSection === "all";

  return (
    <View style={styles.wrap}>
      {showHeader ? (
        <>
          <Text style={styles.title}>{t("buyer.wallet.ops.title")}</Text>
          <Text style={styles.hint}>{t("buyer.wallet.ops.hint")}</Text>
        </>
      ) : null}

      {showTopUp ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t("buyer.wallet.ops.topUp")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder={t("buyer.wallet.ops.amountPlaceholder")}
            value={topUpAmount}
            onChangeText={setTopUpAmount}
          />
          <ActionButton
            label={t("buyer.wallet.ops.topUpCta")}
            icon="add-circle-outline"
            loading={topUpMut.isPending}
            disabled={busy}
            onPress={() => {
              const amount = parseAmount(topUpAmount);
              if (!amount) {
                Alert.alert(t("common.error"), t("buyer.wallet.ops.invalidAmount"));
                return;
              }
              topUpMut.mutate(amount);
            }}
          />
        </View>
      ) : null}

      {showWithdraw ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t("buyer.wallet.ops.withdraw")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder={t("buyer.wallet.ops.amountPlaceholder")}
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
          />
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            placeholder={t("buyer.wallet.ops.phonePlaceholder")}
            value={withdrawPhone}
            onChangeText={setWithdrawPhone}
          />
          <ActionButton
            label={t("buyer.wallet.ops.withdrawCta")}
            icon="arrow-up-circle-outline"
            loading={withdrawMut.isPending}
            disabled={busy}
            onPress={() => {
              const amount = parseAmount(withdrawAmount);
              if (!amount) {
                Alert.alert(t("common.error"), t("buyer.wallet.ops.invalidAmount"));
                return;
              }
              if (amount > balance) {
                Alert.alert(t("common.error"), t("buyer.wallet.ops.insufficientBalance"));
                return;
              }
              withdrawMut.mutate({
                amount,
                phone: withdrawPhone.trim() || undefined
              });
            }}
          />
        </View>
      ) : null}

      {showTransfer ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t("buyer.wallet.ops.transfer")}</Text>
          <Text style={styles.blockHint}>{t("buyer.wallet.ops.transferHint")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            placeholder={t("buyer.wallet.ops.recipientPhonePlaceholder")}
            value={transferPhone}
            onChangeText={(value) => {
              setTransferPhone(value);
              setTransferRecipient(null);
            }}
          />
          <ActionButton
            label={t("buyer.wallet.ops.lookupRecipientCta")}
            icon="search-outline"
            loading={lookupRecipientMut.isPending}
            disabled={busy || !transferPhone.trim()}
            onPress={() => lookupRecipientMut.mutate(transferPhone.trim())}
          />
          {transferRecipient ? (
            <View style={styles.recipientCard}>
              <Text style={styles.recipientName}>{transferRecipient.displayName}</Text>
              <Text style={styles.recipientPhone}>{transferRecipient.phoneMasked}</Text>
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder={t("buyer.wallet.ops.amountPlaceholder")}
            value={transferAmount}
            onChangeText={setTransferAmount}
          />
          <TextInput
            style={styles.input}
            placeholder={t("buyer.wallet.ops.notePlaceholder")}
            value={transferNote}
            onChangeText={setTransferNote}
          />
          <ActionButton
            label={t("buyer.wallet.ops.transferCta")}
            icon="swap-horizontal-outline"
            loading={transferMut.isPending}
            disabled={busy}
            onPress={() => {
              const amount = parseAmount(transferAmount);
              if (!amount || !transferPhone.trim()) {
                Alert.alert(t("common.error"), t("buyer.wallet.ops.transferInvalid"));
                return;
              }
              if (!transferRecipient) {
                Alert.alert(
                  t("common.error"),
                  t("buyer.wallet.ops.recipientNotVerified")
                );
                return;
              }
              if (amount > balance) {
                Alert.alert(t("common.error"), t("buyer.wallet.ops.insufficientBalance"));
                return;
              }
              transferMut.mutate({
                amount,
                recipientPhone: transferPhone.trim(),
                note: transferNote.trim() || undefined
              });
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  loading,
  disabled
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.9 }
      ]}
    >
      {loading ? (
        <ActivityIndicator color={mobileColors.background} />
      ) : (
        <>
          <Ionicons name={icon} size={18} color={mobileColors.background} />
          <Text style={styles.btnLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  title: {
    ...mobileTypography.sectionTitle,
    color: buyerColors.textPrimary
  },
  hint: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: -mobileSpacing.xs
  },
  block: {
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: buyerRadius.card,
    backgroundColor: buyerColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  blockTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    color: buyerColors.textPrimary
  },
  blockHint: {
    ...mobileTypography.meta,
    color: buyerColors.textMuted
  },
  input: {
    borderWidth: 1,
    borderColor: buyerColors.border,
    borderRadius: buyerRadius.button,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: buyerColors.textPrimary,
    backgroundColor: buyerColors.background
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm,
    backgroundColor: buyerColors.primary,
    borderRadius: buyerRadius.button,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md
  },
  btnDisabled: { opacity: 0.55 },
  btnLabel: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    color: mobileColors.background
  },
  recipientCard: {
    padding: mobileSpacing.sm,
    borderRadius: buyerRadius.button,
    backgroundColor: buyerColors.primaryLight,
    gap: 2
  },
  recipientName: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    color: buyerColors.textPrimary
  },
  recipientPhone: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  }
});
