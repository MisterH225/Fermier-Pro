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
import { useSession } from "../../../context/SessionContext";
import {
  chooseMerchantSubscription,
  createMerchantShop,
  fetchMerchantMe,
  patchMerchantOnboarding,
  type MerchantMeDto,
  type MerchantProductDto
} from "../../../lib/api";
import { formatApiError } from "../../../lib/apiErrors";
import { resolveMerchantOnboardingStep } from "../../../lib/merchantOnboardingState";
import { MerchantSubscriptionScreen } from "../../merchant/MerchantSubscriptionScreen";
import { mobileColors, mobileRadius, mobileSpacing, mobileFontSize } from "../../../theme/mobileTheme";

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

export function MerchantOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, refreshAuthMe } = useSession();
  const [step, setStep] = useState(0);
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

  if (step === 0) {
    return (
      <MerchantSubscriptionScreen
        autoAdvanceIfTierChosen
        skippable
        onSkip={async () => {
          if (accessToken && activeProfileId && !me?.subscriptionTier) {
            setBusy(true);
            setError(null);
            try {
              await chooseMerchantSubscription(accessToken, activeProfileId, {
                tier: "free"
              });
            } catch (e) {
              setError(formatApiError(e));
              setBusy(false);
              return;
            }
            setBusy(false);
          }
          await onSubscriptionChosen();
        }}
        onChosen={onSubscriptionChosen}
        onCancel={onCancel}
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
        onSubscriptionRequired={() => setStep(0)}
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
          contentContainerStyle={styles.scroll}
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
