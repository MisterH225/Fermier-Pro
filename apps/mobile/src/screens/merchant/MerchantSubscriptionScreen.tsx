import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
  fetchMerchantMe
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
  const { accessToken, activeProfileId } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier>("free");

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId, "subscription"],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId),
    staleTime: 0
  });

  const premiumPriceXof = meQ.data?.premiumPriceXof;
  const premiumMaxShops = meQ.data?.premiumMaxShops ?? 3;

  const premiumPriceLabel = useMemo(() => {
    if (premiumPriceXof == null) {
      return null;
    }
    return premiumPriceXof.toLocaleString("fr-FR");
  }, [premiumPriceXof]);

  const choose = async () => {
    if (!accessToken || !activeProfileId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await chooseMerchantSubscription(accessToken, activeProfileId, {
        tier: selectedTier,
        paymentMethod: selectedTier === "premium" ? "mobile_money" : undefined
      });
      if ("pending" in res && res.pending) {
        if (res.paymentUrl) {
          await Linking.openURL(res.paymentUrl);
        }
        setError(t("merchant.subscription.premiumPending"));
        return;
      }
      await onChosen();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel =
    selectedTier === "free"
      ? t("merchant.subscription.ctaFree")
      : premiumPriceLabel
        ? t("merchant.subscription.ctaPremium", { price: premiumPriceLabel })
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
          disabled={busy || (selectedTier === "premium" && !premiumPriceLabel)}
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
  }
});
