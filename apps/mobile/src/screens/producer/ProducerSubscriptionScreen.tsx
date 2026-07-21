import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import {
  chooseProducerSubscription,
  confirmProducerSubscription,
  fetchProducerMe,
  fetchUserWallet
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  onChosen: () => void | Promise<void>;
  onCancel: () => void;
};

type Tier = "free" | "premium";
type BillingUnit = "hour" | "day" | "month";
type PaymentMethod = "wallet" | "mobile_money";

function billingPeriodSuffix(
  t: (key: string, opts?: Record<string, unknown>) => string,
  unit: BillingUnit,
  interval: number
): string {
  const n = Math.max(1, interval);
  if (unit === "hour") {
    return n === 1
      ? t("producer.subscription.periodHour")
      : t("producer.subscription.periodHourN", { count: n });
  }
  if (unit === "day") {
    return n === 1
      ? t("producer.subscription.periodDay")
      : t("producer.subscription.periodDayN", { count: n });
  }
  return n === 1
    ? t("producer.subscription.periodMonth")
    : t("producer.subscription.periodMonthN", { count: n });
}

export function ProducerSubscriptionScreen({ onChosen, onCancel }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomChromePad = useBottomChromePad();
  const footerBottomPad = Math.max(bottomChromePad, mobileSpacing.md);
  const { accessToken, activeProfileId, refreshAuthMe } = useSession();
  const queryClient = useQueryClient();
  const completingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier>("premium");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [pendingPayment, setPendingPayment] = useState<{
    providerRef: string;
    paymentUrl: string | null;
    amount: number;
    invoiceId?: string;
  } | null>(null);

  const meQ = useQuery({
    queryKey: ["producer-me", activeProfileId],
    queryFn: () => fetchProducerMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId),
    staleTime: 0,
    refetchInterval: pendingPayment ? 5_000 : false
  });

  const walletQ = useQuery({
    queryKey: ["user-wallet", activeProfileId],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken && selectedTier === "premium")
  });

  const billingUnit: BillingUnit = meQ.data?.billingUnit ?? "month";
  const billingInterval = meQ.data?.billingInterval ?? 1;
  const trialAvailable = Boolean(meQ.data?.trialAvailable);
  const trialUnits = meQ.data?.trialUnits ?? 7;
  const premiumPriceXof = meQ.data?.premiumPriceXof;
  const walletBalance = Number(walletQ.data?.balance ?? 0);
  const canPayWithWallet =
    premiumPriceXof != null && walletBalance >= premiumPriceXof;

  const periodSuffix = useMemo(
    () => billingPeriodSuffix(t, billingUnit, billingInterval),
    [t, billingUnit, billingInterval]
  );

  const premiumPriceLabel =
    premiumPriceXof != null ? premiumPriceXof.toLocaleString("fr-FR") : null;

  const completeIfPremium = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    await refreshAuthMe();
    await queryClient.invalidateQueries({ queryKey: ["producer-me"] });
    await onChosen();
  }, [onChosen, queryClient, refreshAuthMe]);

  const handleChoose = async (opts?: { startTrial?: boolean }) => {
    if (!accessToken || !activeProfileId) return;
    setBusy(true);
    setError(null);
    try {
      if (selectedTier === "free") {
        await chooseProducerSubscription(accessToken, activeProfileId, {
          tier: "free"
        });
        await refreshAuthMe();
        await onChosen();
        return;
      }

      const res = await chooseProducerSubscription(accessToken, activeProfileId, {
        tier: "premium",
        paymentMethod,
        startTrial: opts?.startTrial
      });

      if ("pending" in res && res.pending) {
        setPendingPayment({
          providerRef: res.providerRef,
          paymentUrl: res.paymentUrl ?? null,
          amount: res.amount,
          invoiceId: res.invoiceId
        });
        return;
      }

      await completeIfPremium();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const trySilentConfirm = useCallback(async () => {
    if (!accessToken || !activeProfileId || !pendingPayment?.providerRef) {
      return;
    }
    try {
      await confirmProducerSubscription(
        accessToken,
        activeProfileId,
        pendingPayment.providerRef,
        pendingPayment.invoiceId
      );
      setPendingPayment(null);
      await completeIfPremium();
    } catch {
      // Le webhook ou le prochain poll confirmera l'activation.
    }
  }, [
    accessToken,
    activeProfileId,
    pendingPayment?.providerRef,
    pendingPayment?.invoiceId,
    completeIfPremium
  ]);

  const handleConfirmPayment = async () => {
    if (!accessToken || !activeProfileId || !pendingPayment) return;
    setBusy(true);
    setError(null);
    try {
      await confirmProducerSubscription(
        accessToken,
        activeProfileId,
        pendingPayment.providerRef,
        pendingPayment.invoiceId
      );
      setPendingPayment(null);
      await completeIfPremium();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openPaymentUrl = () => {
    const url = pendingPayment?.paymentUrl?.trim();
    if (url) {
      void Linking.openURL(url);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && pendingPayment) {
        void meQ.refetch().then(async (r) => {
          if (r.data?.teamPremiumActive) {
            await completeIfPremium();
            return;
          }
          await trySilentConfirm();
        });
      }
    });
    return () => sub.remove();
  }, [completeIfPremium, meQ, pendingPayment, trySilentConfirm]);

  if (meQ.data?.teamPremiumActive) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={48} color={mobileColors.accent} />
          <Text style={styles.activeTitle}>{t("producer.subscription.alreadyPremium")}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void onChosen()}>
            <Text style={styles.primaryBtnTxt}>{t("producer.close")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable style={styles.backBtn} onPress={onCancel}>
          <Ionicons name="arrow-back" size={22} color={mobileColors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t("producer.subscription.title")}</Text>
        <Text style={styles.subtitle}>{t("producer.subscription.subtitle")}</Text>

        {pendingPayment ? (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>
              {t("producer.subscription.paymentWaitingTitle")}
            </Text>
            <Text style={styles.pendingBody}>
              {t("producer.subscription.paymentWaitingBody")}
            </Text>
            {pendingPayment.paymentUrl ? (
              <Pressable style={styles.secondaryBtn} onPress={openPaymentUrl}>
                <Text style={styles.secondaryBtnTxt}>
                  {t("producer.subscription.reopenPaymentCta")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void handleConfirmPayment()}
            >
              {busy ? (
                <ActivityIndicator color={mobileColors.background} />
              ) : (
                <Text style={styles.primaryBtnTxt}>
                  {t("producer.subscription.confirmPaymentCta")}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.planRow}>
              <Pressable
                style={[styles.planCard, selectedTier === "free" && styles.planSelected]}
                onPress={() => setSelectedTier("free")}
              >
                <Text style={styles.planTitle}>{t("producer.subscription.freeTitle")}</Text>
                <Text style={styles.planFeature}>{t("producer.subscription.freeSolo")}</Text>
                <Text style={styles.planPrice}>{t("producer.subscription.freePrice")}</Text>
              </Pressable>
              <Pressable
                style={[styles.planCard, selectedTier === "premium" && styles.planSelected]}
                onPress={() => setSelectedTier("premium")}
              >
                <Text style={styles.planTitle}>{t("producer.subscription.premiumTitle")}</Text>
                <Text style={styles.planFeature}>{t("producer.subscription.premiumTeam")}</Text>
                <Text style={styles.planFeature}>{t("producer.subscription.premiumQr")}</Text>
                <Text style={styles.planPrice}>
                  {premiumPriceLabel
                    ? t("producer.subscription.premiumPrice", {
                        price: premiumPriceLabel,
                        period: periodSuffix
                      })
                    : "…"}
                </Text>
              </Pressable>
            </View>

            {selectedTier === "premium" ? (
              <View style={styles.paymentRow}>
                <Pressable
                  style={[
                    styles.payChip,
                    paymentMethod === "mobile_money" && styles.payChipActive
                  ]}
                  onPress={() => setPaymentMethod("mobile_money")}
                >
                  <Text style={styles.payChipTxt}>
                    {t("producer.subscription.payMobileMoney")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.payChip,
                    paymentMethod === "wallet" && styles.payChipActive,
                    !canPayWithWallet && styles.payChipDisabled
                  ]}
                  onPress={() => canPayWithWallet && setPaymentMethod("wallet")}
                >
                  <Text style={styles.payChipTxt}>
                    {t("producer.subscription.payWallet")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </ScrollView>

      {!pendingPayment ? (
        <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
          {selectedTier === "premium" && trialAvailable ? (
            <Pressable
              style={[styles.secondaryBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void handleChoose({ startTrial: true })}
            >
              <Text style={styles.secondaryBtnTxt}>
                {t("producer.subscription.ctaTrial", { units: trialUnits })}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void handleChoose()}
          >
            {busy ? (
              <ActivityIndicator color={mobileColors.background} />
            ) : (
              <Text style={styles.primaryBtnTxt}>
                {selectedTier === "free"
                  ? t("producer.subscription.chooseFree")
                  : t("producer.subscription.choosePremium")}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  scroll: { padding: mobileSpacing.lg, paddingBottom: mobileSpacing.xl },
  backBtn: { marginBottom: mobileSpacing.md },
  title: { ...mobileTypography.title, color: mobileColors.textPrimary },
  subtitle: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs,
    marginBottom: mobileSpacing.lg
  },
  planRow: { flexDirection: "row", gap: mobileSpacing.md },
  planCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.surface
  },
  planSelected: { borderColor: mobileColors.accent, borderWidth: 2 },
  planTitle: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  planFeature: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  planPrice: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent,
    marginTop: mobileSpacing.sm
  },
  paymentRow: { flexDirection: "row", gap: mobileSpacing.sm, marginTop: mobileSpacing.lg },
  payChip: {
    flex: 1,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center"
  },
  payChipActive: { borderColor: mobileColors.accent, backgroundColor: mobileColors.accentSoft },
  payChipDisabled: { opacity: 0.45 },
  payChipTxt: { ...mobileTypography.meta, color: mobileColors.textPrimary },
  footer: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    gap: mobileSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryBtnTxt: { ...mobileTypography.body, fontWeight: "700", color: mobileColors.background },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  secondaryBtnTxt: { ...mobileTypography.body, fontWeight: "700", color: mobileColors.accent },
  btnDisabled: { opacity: 0.6 },
  error: { color: mobileColors.error, marginTop: mobileSpacing.md },
  pendingCard: {
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.surface,
    borderWidth: 1,
    borderColor: mobileColors.border,
    gap: mobileSpacing.md
  },
  pendingTitle: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  pendingBody: { ...mobileTypography.body, color: mobileColors.textSecondary },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  activeTitle: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary, textAlign: "center" }
});
