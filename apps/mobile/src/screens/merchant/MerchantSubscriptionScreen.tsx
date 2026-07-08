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
  chooseMerchantSubscription,
  confirmMerchantSubscription,
  fetchMerchantMe,
  fetchUserWallet
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  skippable?: boolean;
  onSkip?: () => void;
  onChosen: () => void | Promise<void>;
  onCancel: () => void;
};

type Tier = "free" | "premium";

const FEATURES = [
  { key: "shop", emoji: "🏪" },
  { key: "products", emoji: "📦" },
  { key: "sales", emoji: "📈" }
] as const;

const FREE_PLAN_KEYS = ["freeShop", "freeProducts"] as const;
const PREMIUM_PLAN_KEYS = ["premiumShops", "premiumProducts", "billingMonthly"] as const;

type PaymentMethod = "wallet" | "mobile_money";
type PendingPayment = {
  providerRef: string;
  paymentUrl: string | null;
  amount: number;
  invoiceId?: string;
};

export function MerchantSubscriptionScreen({
  skippable = false,
  onSkip,
  onChosen,
  onCancel
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomChromePad = useBottomChromePad();
  const footerBottomPad = skippable
    ? Math.max(insets.bottom, mobileSpacing.md)
    : Math.max(bottomChromePad, mobileSpacing.md);
  const { accessToken, activeProfileId, refreshAuthMe } = useSession();
  const queryClient = useQueryClient();
  const advancedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier>("free");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId, "subscription"],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId),
    staleTime: 0
  });

  const walletQ = useQuery({
    queryKey: ["user-wallet", activeProfileId],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken && selectedTier === "premium")
  });

  const premiumPriceXof = meQ.data?.premiumPriceXof;
  const premiumMaxShops = meQ.data?.premiumMaxShops ?? 3;
  const walletBalance = Number(walletQ.data?.balance ?? 0);
  const canPayWithWallet =
    premiumPriceXof != null && walletBalance >= premiumPriceXof;

  useEffect(() => {
    const pending = meQ.data?.pendingSubscription;
    if (pending?.providerRef) {
      setPendingPayment({
        providerRef: pending.providerRef,
        paymentUrl: pending.paymentUrl,
        amount: pending.amount,
        invoiceId: pending.invoiceId
      });
      setSelectedTier("premium");
    }
  }, [meQ.data?.pendingSubscription]);

  useEffect(() => {
    if (advancedRef.current || !meQ.data?.subscriptionTier) {
      return;
    }
    advancedRef.current = true;
    void onChosen();
  }, [meQ.data?.subscriptionTier, onChosen]);

  const invalidateMerchant = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["merchant-me", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-dashboard", activeProfileId] });
    await refreshAuthMe();
  }, [activeProfileId, queryClient, refreshAuthMe]);

  const confirmPendingPayment = useCallback(async () => {
    if (!accessToken || !activeProfileId || !pendingPayment?.providerRef) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmMerchantSubscription(
        accessToken,
        activeProfileId,
        pendingPayment.providerRef
      );
      setPendingPayment(null);
      await invalidateMerchant();
      await meQ.refetch();
      await onChosen();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }, [
    accessToken,
    activeProfileId,
    pendingPayment?.providerRef,
    invalidateMerchant,
    meQ,
    onChosen
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && pendingPayment?.providerRef) {
        void confirmPendingPayment();
      }
    });
    return () => sub.remove();
  }, [pendingPayment?.providerRef, confirmPendingPayment]);

  const premiumPriceLabel = useMemo(() => {
    if (premiumPriceXof == null) {
      return null;
    }
    return premiumPriceXof.toLocaleString("fr-FR");
  }, [premiumPriceXof]);

  const choose = async () => {
    if (!accessToken || !activeProfileId) return;
    if (pendingPayment) {
      await confirmPendingPayment();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await chooseMerchantSubscription(accessToken, activeProfileId, {
        tier: selectedTier,
        paymentMethod:
          selectedTier === "premium" ? paymentMethod : undefined
      });
      if ("pending" in res && res.pending) {
        setPendingPayment({
          providerRef: res.providerRef,
          paymentUrl: res.paymentUrl ?? null,
          amount: res.amount,
          invoiceId: res.invoiceId
        });
        if (res.paymentUrl) {
          await Linking.openURL(res.paymentUrl);
        }
        return;
      }
      await invalidateMerchant();
      await onChosen();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openPaymentLink = async () => {
    if (!pendingPayment?.paymentUrl) {
      setError(t("merchant.subscription.paymentLinkMissing"));
      return;
    }
    await Linking.openURL(pendingPayment.paymentUrl);
  };

  const ctaLabel = pendingPayment
    ? t("merchant.subscription.confirmPaymentCta")
    : selectedTier === "free"
      ? t("merchant.subscription.ctaFree")
      : premiumPriceLabel
        ? paymentMethod === "wallet"
          ? t("merchant.subscription.ctaPremiumWallet", { price: premiumPriceLabel })
          : t("merchant.subscription.ctaPremium", { price: premiumPriceLabel })
        : t("merchant.subscription.ctaPremiumLoading");

  const freeFeatures = FREE_PLAN_KEYS.map((key) => t(`merchant.subscription.${key}`));
  const premiumFeatures = PREMIUM_PLAN_KEYS.map((key) =>
    key === "premiumShops"
      ? t(`merchant.subscription.${key}`, { count: premiumMaxShops })
      : t(`merchant.subscription.${key}`)
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top"]}
      testID="merchant-subscription-screen"
    >
      <View style={styles.skyGlow} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: footerBottomPad + 88 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title} testID="merchant-subscription-title">
            {t("merchant.subscription.title")}
          </Text>
          <Text style={styles.subtitle}>{t("merchant.subscription.subtitle")}</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.key} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>
                  {t(`merchant.subscription.features.${f.key}.title`)}
                </Text>
                <Text style={styles.featureCaption}>
                  {t(`merchant.subscription.features.${f.key}.caption`)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.chooseLabel}>{t("merchant.subscription.choosePlan")}</Text>

        <View style={styles.planRow}>
          <PlanCard
            testID="merchant-subscription-plan-free"
            selected={selectedTier === "free"}
            onPress={() => setSelectedTier("free")}
            icon="🌱"
            name={t("merchant.subscription.freeTitle")}
            price={t("merchant.subscription.freePrice")}
            caption={t("merchant.subscription.freeCaption")}
            features={freeFeatures}
          />
          <PlanCard
            testID="merchant-subscription-plan-premium"
            selected={selectedTier === "premium"}
            onPress={() => setSelectedTier("premium")}
            icon="👑"
            name={t("merchant.subscription.premiumTitle")}
            price={
              premiumPriceLabel
                ? t("merchant.subscription.premiumPrice", { price: premiumPriceLabel })
                : "…"
            }
            caption={t("merchant.subscription.premiumCaption")}
            features={premiumFeatures}
            highlight
          />
        </View>

        {pendingPayment ? (
          <View style={styles.pendingBox} testID="merchant-subscription-pending-box">
            <Text style={styles.pendingTitle}>
              {t("merchant.subscription.paymentPendingTitle")}
            </Text>
            <Text style={styles.pendingBody}>
              {t("merchant.subscription.premiumPending")}
            </Text>
            {pendingPayment.paymentUrl ? (
              <Pressable style={styles.pendingLinkBtn} onPress={() => void openPaymentLink()}>
                <Text style={styles.pendingLinkTx}>
                  {t("merchant.subscription.payWithWave")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {selectedTier === "premium" && !pendingPayment ? (
          <View style={styles.payMethodBlock}>
            <Text style={styles.payMethodLabel}>
              {t("merchant.subscription.paymentMethodLabel")}
            </Text>
            <View style={styles.payMethodRow}>
              <Pressable
                style={[
                  styles.payMethodChip,
                  paymentMethod === "mobile_money" && styles.payMethodChipOn
                ]}
                onPress={() => setPaymentMethod("mobile_money")}
                testID="merchant-subscription-pay-mobile-money"
              >
                <Text
                  style={[
                    styles.payMethodTx,
                    paymentMethod === "mobile_money" && styles.payMethodTxOn
                  ]}
                >
                  {t("merchant.subscription.payMobileMoney")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.payMethodChip,
                  paymentMethod === "wallet" && styles.payMethodChipOn,
                  !canPayWithWallet && styles.payMethodChipDisabled
                ]}
                onPress={() => canPayWithWallet && setPaymentMethod("wallet")}
                disabled={!canPayWithWallet}
                testID="merchant-subscription-pay-wallet"
              >
                <Text
                  style={[
                    styles.payMethodTx,
                    paymentMethod === "wallet" && styles.payMethodTxOn
                  ]}
                >
                  {t("merchant.subscription.payWallet")}
                </Text>
              </Pressable>
            </View>
            {paymentMethod === "wallet" && premiumPriceLabel ? (
              <Text style={styles.walletHint}>
                {t("merchant.subscription.walletBalanceHint", {
                  balance: walletBalance.toLocaleString("fr-FR"),
                  price: premiumPriceLabel
                })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {skippable && onSkip ? (
          <Pressable
            style={styles.skip}
            onPress={onSkip}
            disabled={busy}
            testID="merchant-subscription-skip"
          >
            <Text style={styles.skipTx}>{t("merchant.onboarding.skip")}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.cancel}
          onPress={onCancel}
          disabled={busy}
          testID="merchant-subscription-cancel"
        >
          <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
        </Pressable>

        {error ? (
          <Text style={styles.err} testID="merchant-subscription-error">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
        <Pressable
          style={[styles.cta, busy && styles.ctaDisabled]}
          disabled={
            busy ||
            (!pendingPayment &&
              selectedTier === "premium" &&
              !premiumPriceLabel) ||
            (!pendingPayment &&
              selectedTier === "premium" &&
              paymentMethod === "wallet" &&
              !canPayWithWallet)
          }
          onPress={() => void choose()}
          testID="merchant-subscription-cta"
        >
          {busy ? (
            <ActivityIndicator color={merchantColors.onPrimary} />
          ) : (
            <Text style={styles.ctaTx} testID="merchant-subscription-cta-label">
              {ctaLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PlanCard({
  testID,
  selected,
  onPress,
  icon,
  name,
  price,
  caption,
  features,
  highlight = false
}: {
  testID: string;
  selected: boolean;
  onPress: () => void;
  icon: string;
  name: string;
  price: string;
  caption: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.planCard,
        merchantShadow.card,
        highlight && styles.planCardPremium,
        selected && styles.planCardSelected
      ]}
    >
      {selected ? (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={14} color={merchantColors.onPrimary} />
        </View>
      ) : null}
      <Text style={styles.planIcon}>{icon}</Text>
      <Text style={styles.planName}>{name}</Text>
      <Text style={styles.planPrice}>{price}</Text>
      <Text style={styles.planCaption}>{caption}</Text>
      <View style={styles.planFeatures}>
        {features.map((line) => (
          <View key={line} style={styles.planFeatureRow}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={selected ? merchantColors.primary : merchantColors.textMuted}
            />
            <Text
              style={[
                styles.planFeatureTx,
                selected && styles.planFeatureTxSelected
              ]}
            >
              {line}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: merchantColors.canvas
  },
  skyGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: merchantColors.primaryLight,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    opacity: 0.85
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md
  },
  header: {
    alignItems: "center",
    marginBottom: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: merchantColors.textPrimary,
    textAlign: "center"
  },
  subtitle: {
    ...mobileTypography.body,
    color: merchantColors.textSecondary,
    textAlign: "center",
    marginTop: mobileSpacing.xs,
    maxWidth: 300
  },
  features: {
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.xl
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.md
  },
  featureEmoji: {
    fontSize: 28,
    lineHeight: 34
  },
  featureText: {
    flex: 1,
    gap: 2
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: merchantColors.textPrimary
  },
  featureCaption: {
    fontSize: 13,
    color: merchantColors.textSecondary
  },
  chooseLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: merchantColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  planRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    alignItems: "stretch"
  },
  planCard: {
    flex: 1,
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    borderWidth: 2,
    borderColor: "transparent",
    padding: mobileSpacing.md,
    alignItems: "center",
    minHeight: 220,
    position: "relative"
  },
  planCardPremium: {
    backgroundColor: "#FFFBEB"
  },
  planCardSelected: {
    borderColor: merchantColors.primary
  },
  checkBadge: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: merchantColors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: merchantColors.cardBg
  },
  planIcon: {
    fontSize: 28,
    marginBottom: mobileSpacing.xs
  },
  planName: {
    fontSize: 13,
    fontWeight: "600",
    color: merchantColors.textSecondary
  },
  planPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: merchantColors.textPrimary,
    marginTop: 4,
    textAlign: "center"
  },
  planCaption: {
    fontSize: 11,
    color: merchantColors.textMuted,
    marginTop: 4,
    textAlign: "center"
  },
  planFeatures: {
    width: "100%",
    marginTop: mobileSpacing.sm,
    gap: 6
  },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6
  },
  planFeatureTx: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: merchantColors.textSecondary
  },
  planFeatureTxSelected: {
    color: merchantColors.textPrimary,
    fontWeight: "600"
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    backgroundColor: merchantColors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: merchantColors.border
  },
  cta: {
    backgroundColor: merchantColors.primary,
    borderRadius: merchantRadius.pill,
    paddingVertical: 16,
    paddingHorizontal: mobileSpacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54
  },
  ctaDisabled: {
    opacity: 0.7
  },
  ctaTx: {
    color: merchantColors.onPrimary,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center"
  },
  skip: {
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    marginTop: mobileSpacing.sm
  },
  skipTx: {
    color: merchantColors.primary,
    fontWeight: "600"
  },
  cancel: {
    alignItems: "center",
    paddingBottom: mobileSpacing.sm
  },
  cancelTx: {
    color: merchantColors.textSecondary
  },
  err: {
    color: merchantColors.danger,
    textAlign: "center",
    marginTop: mobileSpacing.sm
  },
  pendingBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: merchantRadius.card,
    borderWidth: 1,
    borderColor: "#F59E0B",
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  pendingTitle: {
    fontWeight: "800",
    color: merchantColors.textPrimary,
    fontSize: 15
  },
  pendingBody: {
    color: merchantColors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  pendingLinkBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: merchantRadius.pill,
    backgroundColor: merchantColors.primary
  },
  pendingLinkTx: {
    color: merchantColors.onPrimary,
    fontWeight: "700",
    fontSize: 13
  },
  payMethodBlock: {
    marginBottom: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  payMethodLabel: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: merchantColors.textSecondary
  },
  payMethodRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  payMethodChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: merchantRadius.pill,
    borderWidth: 1,
    borderColor: merchantColors.border,
    backgroundColor: merchantColors.cardBg,
    alignItems: "center"
  },
  payMethodChipOn: {
    borderColor: merchantColors.primary,
    backgroundColor: merchantColors.primaryLight
  },
  payMethodChipDisabled: {
    opacity: 0.45
  },
  payMethodTx: {
    fontSize: 12,
    fontWeight: "600",
    color: merchantColors.textSecondary,
    textAlign: "center"
  },
  payMethodTxOn: {
    color: merchantColors.primary
  },
  walletHint: {
    fontSize: 12,
    color: merchantColors.textMuted,
    textAlign: "center"
  }
});
