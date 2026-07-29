import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MerchantProductForm } from "../../../components/merchant/MerchantProductForm";
import { OnboardingPlanChoiceStep } from "../../../components/subscription/OnboardingPlanChoiceStep";
import { useModal } from "../../../components/modals/useModal";
import { useSession } from "../../../context/SessionContext";
import {
  chooseMerchantSubscription,
  createMerchantShop,
  fetchMerchantMe,
  isSubscriptionLimitError,
  patchMerchantOnboarding,
  type MerchantMeDto,
  type MerchantProductDto
} from "../../../lib/api";
import { formatApiError } from "../../../lib/apiErrors";
import { resolveMerchantOnboardingStep } from "../../../lib/merchantOnboardingState";
import { useScrollBottomPad } from "../../../hooks/useScrollBottomPad";
import { MerchantSubscriptionScreen } from "../../merchant/MerchantSubscriptionScreen";
import { mobileColors, mobileRadius, mobileSpacing, mobileFontSize } from "../../../theme/mobileTheme";

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

export function MerchantOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const scrollPad = useScrollBottomPad({ includeChrome: false });
  const queryClient = useQueryClient();
  const { open } = useModal();
  const { accessToken, activeProfileId, refreshAuthMe } = useSession();
  const [step, setStep] = useState(0);
  const [premiumCheckout, setPremiumCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MerchantMeDto | null>(null);
  const [shopName, setShopName] = useState("");

  const loadMe = async () => {
    if (!accessToken || !activeProfileId) return;
    const data = await fetchMerchantMe(accessToken, activeProfileId);
    setMe(data);
    return data;
  };

  const invalidateMerchantCache = async () => {
    if (!activeProfileId) return;
    await queryClient.invalidateQueries({ queryKey: ["merchant-me", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-dashboard", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-products", activeProfileId] });
  };

  const resumeFromServer = useCallback(
    async (data: MerchantMeDto) => {
      setPremiumCheckout(false);
      const next = resolveMerchantOnboardingStep(data);
      if (next === "finished") {
        if (!data.onboardingComplete && accessToken && activeProfileId) {
          await patchMerchantOnboarding(accessToken, activeProfileId, {
            onboardingComplete: true
          });
        }
        await refreshAuthMe();
        onFinished();
        return;
      }
      const shopCount = data.shopCount ?? data.shops?.length ?? 0;
      // Filet : jamais l'étape produit sans boutique réelle.
      if (next === 2 && shopCount === 0) {
        setStep(1);
        return;
      }
      setStep(next);
    },
    [accessToken, activeProfileId, onFinished, refreshAuthMe]
  );

  useEffect(() => {
    void (async () => {
      try {
        const data = await loadMe();
        if (!data) return;
        await resumeFromServer(data);
      } catch (e) {
        setError(formatApiError(e));
      }
    })();
  }, [accessToken, activeProfileId, resumeFromServer]);

  const completeOnboarding = async () => {
    if (!accessToken || !activeProfileId) return;
    await patchMerchantOnboarding(accessToken, activeProfileId, {
      onboardingComplete: true
    });
    await invalidateMerchantCache();
    await refreshAuthMe();
    onFinished();
  };

  const skipStep = async (flags: {
    shopSkipped?: boolean;
    productSkipped?: boolean;
  }) => {
    if (!accessToken || !activeProfileId) return;
    setBusy(true);
    setError(null);
    try {
      await patchMerchantOnboarding(accessToken, activeProfileId, {
        ...flags,
        onboardingComplete: true
      });
      await invalidateMerchantCache();
      await refreshAuthMe();
      onFinished();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseStandardAndContinue = async () => {
    if (!accessToken || !activeProfileId) return;
    setBusy(true);
    setError(null);
    try {
      if (!me?.subscriptionTier) {
        await chooseMerchantSubscription(accessToken, activeProfileId, {
          tier: "free"
        });
      }
      const data = await loadMe();
      if (data) {
        await resumeFromServer(data);
      }
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const loadPlanLimits = useCallback(async () => {
    if (!accessToken || !activeProfileId) {
      return {};
    }
    const data = await fetchMerchantMe(accessToken, activeProfileId);
    setMe(data);
    return {
      standardMaxShops: data.standardMaxShops ?? data.maxShops ?? null,
      standardMaxProductsPerShop:
        data.standardMaxProductsPerShop ?? data.maxActiveProducts ?? null,
      premiumMaxShops: data.premiumMaxShops ?? null,
      premiumMaxProductsPerShop: data.premiumMaxProductsPerShop ?? null
    };
  }, [accessToken, activeProfileId]);

  const onCreateShop = async () => {
    if (!accessToken || !activeProfileId || !shopName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createMerchantShop(accessToken, activeProfileId, {
        name: shopName.trim()
      });
      const data = await loadMe();
      await invalidateMerchantCache();
      await refreshAuthMe();
      if (data) {
        await resumeFromServer(data);
      }
    } catch (e) {
      if (isSubscriptionLimitError(e) && e.code === "SHOP_LIMIT_REACHED") {
        open("upgrade-limit", {
          code: e.code,
          limit: me?.maxShops ?? me?.standardMaxShops ?? null,
          onUpgrade: () => {
            setPremiumCheckout(true);
            setStep(0);
          }
        });
        return;
      }
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubscriptionChosen = async () => {
    const data = await loadMe();
    if (data) {
      await resumeFromServer(data);
    }
  };

  const onProductSuccess = async (_product: MerchantProductDto) => {
    setError(null);
    try {
      await completeOnboarding();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  if (step === 0 && premiumCheckout) {
    return (
      <MerchantSubscriptionScreen
        autoAdvanceIfTierChosen
        skippable
        initialTier="premium"
        onSkip={() => void chooseStandardAndContinue()}
        onChosen={onSubscriptionChosen}
        onCancel={() => void chooseStandardAndContinue()}
      />
    );
  }

  if (step === 0) {
    return (
      <OnboardingPlanChoiceStep
        role="merchant"
        loadLimits={loadPlanLimits}
        busy={busy}
        onChooseStandard={chooseStandardAndContinue}
        onChooseLater={chooseStandardAndContinue}
        onChoosePremium={() => setPremiumCheckout(true)}
      />
    );
  }

  if (step === 2) {
    const shopId = me?.shops?.[0]?.id ?? null;
    return (
      <MerchantProductForm
        mode="onboarding"
        shopId={shopId}
        allowPublish
        onSuccess={(product) => void onProductSuccess(product)}
        onSkip={() => void skipStep({ productSkipped: true })}
        onNeedShop={() => setStep(1)}
        onSubscriptionRequired={() => {
          setPremiumCheckout(true);
          setStep(0);
        }}
      />
    );
  }

  // step === 1 : création boutique
  return (
    <SafeAreaView style={styles.safe} testID="merchant-onboarding-shop-step">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>{t("merchant.onboarding.shopTitle")}</Text>
          <TextInput
            style={styles.input}
            value={shopName}
            onChangeText={setShopName}
            placeholder={t("merchant.onboarding.shopName")}
            testID="merchant-onboarding-shop-name"
          />
          <Pressable
            style={styles.primary}
            onPress={() => void onCreateShop()}
            disabled={busy || !shopName.trim()}
            testID="merchant-onboarding-create-shop"
          >
            {busy ? (
              <ActivityIndicator color={mobileColors.background} />
            ) : (
              <Text style={styles.primaryTx}>{t("merchant.onboarding.createShop")}</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => void skipStep({ shopSkipped: true })}
            disabled={busy}
            testID="merchant-onboarding-skip-shop"
          >
            <Text style={styles.secondaryTx}>{t("merchant.onboarding.skip")}</Text>
          </Pressable>
          {error ? <Text style={styles.err}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  flex: { flex: 1 },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { fontSize: mobileFontSize.xl, fontWeight: "700", color: mobileColors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background
  },
  primary: {
    backgroundColor: mobileColors.accent,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  primaryTx: { color: mobileColors.background, fontWeight: "700" },
  secondary: { padding: mobileSpacing.md, alignItems: "center" },
  secondaryTx: { color: mobileColors.accent, fontWeight: "600" },
  err: { color: mobileColors.error }
});
