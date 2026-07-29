import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkipConfirmModal } from "../../components/onboarding/SkipConfirmModal";
import { StepProgressBar } from "../../components/onboarding/StepProgressBar";
import { OnboardingPlanChoiceStep } from "../../components/subscription/OnboardingPlanChoiceStep";
import { useOnboardingResume } from "../../context/OnboardingResumeContext";
import { useSession } from "../../context/SessionContext";
import { useOnboarding } from "../../hooks/useOnboarding";
import {
  chooseProducerSubscription,
  fetchProducerMe,
  postOnboardingComplete,
  postOnboardingSkip
} from "../../lib/api";
import { useModal } from "../../components/modals/useModal";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { ProducerSubscriptionScreen } from "../producer/ProducerSubscriptionScreen";
import { Step1Project } from "./steps/Step1Project";
import { Step2Breeders } from "./steps/Step2Breeders";
import { Step3Production } from "./steps/Step3Production";
import { Step4Pens } from "./steps/Step4Pens";
import { StepCompletion } from "./steps/StepCompletion";

type Props = {
  onFinished: () => void;
};

type Phase = "loading" | "plan" | "premiumPay" | "form";

export function OnboardingScreen({ onFinished }: Props) {
  const { t } = useTranslation();
  const scrollPad = useScrollBottomPad({ includeChrome: false });
  const { accessToken, activeProfileId, refreshAuthMe } = useSession();
  const { clearResume } = useOnboardingResume();
  const { open } = useModal();
  const ob = useOnboarding();
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [planBusy, setPlanBusy] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!accessToken || !activeProfileId) {
        if (!cancelled) setPhase("plan");
        return;
      }
      try {
        const me = await fetchProducerMe(accessToken, activeProfileId);
        if (cancelled) return;
        if (me.subscriptionTier || me.subscriptionChosenAt) {
          setPhase("form");
        } else {
          setPhase("plan");
        }
      } catch {
        if (!cancelled) setPhase("plan");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeProfileId]);

  const loadPlanLimits = useCallback(async () => {
    if (!accessToken || !activeProfileId) {
      return {};
    }
    const me = await fetchProducerMe(accessToken, activeProfileId);
    return {
      standardMaxFarms: me.standardMaxFarms ?? null,
      premiumMaxFarms: me.premiumMaxFarms ?? null
    };
  }, [accessToken, activeProfileId]);

  const chooseStandardAndContinue = async () => {
    if (!accessToken || !activeProfileId) {
      setPhase("form");
      return;
    }
    setPlanBusy(true);
    try {
      await chooseProducerSubscription(accessToken, activeProfileId, {
        tier: "free"
      });
      await refreshAuthMe();
      setPhase("form");
    } catch (e) {
      Alert.alert(t("onboarding.errorTitle"), getUserFacingError(e, t));
    } finally {
      setPlanBusy(false);
    }
  };

  const skipMut = useMutation({
    mutationFn: () =>
      postOnboardingSkip(accessToken, activeProfileId),
    onSuccess: async () => {
      clearResume();
      await refreshAuthMe();
      onFinished();
    },
    onError: (e: Error) => {
      Alert.alert(t("onboarding.errorTitle"), getUserFacingError(e, t));
    }
  });

  const completeMut = useMutation({
    mutationFn: () => {
      const payload = ob.toPayload();
      if (!payload) {
        throw new Error(t("onboarding.validationIncomplete"));
      }
      return postOnboardingComplete(accessToken, payload, activeProfileId);
    },
    onSuccess: async () => {
      clearResume();
      await refreshAuthMe();
      open("success", {
        message: t("onboarding.completion.success"),
        autoDismissMs: 2500
      });
      onFinished();
    },
    onError: (e: Error) => {
      Alert.alert(t("onboarding.errorTitle"), getUserFacingError(e, t));
    }
  });

  const onNext = () => {
    if (ob.step < 3) {
      ob.setStep((s) => s + 1);
      return;
    }
    if (ob.step === 3) {
      ob.setStep(4);
      return;
    }
  };

  const onBack = () => {
    if (ob.step > 0 && ob.step < 4) {
      ob.setStep((s) => s - 1);
    }
  };

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loader}>
          <ActivityIndicator color={mobileColors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "plan") {
    return (
      <OnboardingPlanChoiceStep
        role="producer"
        loadLimits={loadPlanLimits}
        busy={planBusy}
        onChooseStandard={chooseStandardAndContinue}
        onChooseLater={chooseStandardAndContinue}
        onChoosePremium={() => setPhase("premiumPay")}
      />
    );
  }

  if (phase === "premiumPay") {
    return (
      <ProducerSubscriptionScreen
        skippable
        autoAdvanceIfTierChosen
        initialTier="premium"
        onSkip={() => void chooseStandardAndContinue()}
        onCancel={() => void chooseStandardAndContinue()}
        onChosen={async () => {
          await refreshAuthMe();
          setPhase("form");
        }}
      />
    );
  }

  const busy = skipMut.isPending || completeMut.isPending;
  const isCompletion = ob.step === 4;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom"]}
      testID="onboarding-screen"
    >
      {!isCompletion ? (
        <Pressable
          style={styles.skipTop}
          onPress={() => setSkipModalOpen(true)}
          disabled={busy}
        >
          <Text style={styles.skipTopText}>{t("onboarding.skipLink")}</Text>
        </Pressable>
      ) : (
        <View style={styles.skipTop} />
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
        keyboardShouldPersistTaps="handled"
      >
        {!isCompletion ? (
          <StepProgressBar step={ob.step} total={4} />
        ) : null}
        {ob.step === 0 ? <Step1Project ob={ob} /> : null}
        {ob.step === 1 ? <Step2Breeders ob={ob} /> : null}
        {ob.step === 2 ? <Step3Production ob={ob} /> : null}
        {ob.step === 3 ? <Step4Pens ob={ob} /> : null}
        {ob.step === 4 ? <StepCompletion ob={ob} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        {!isCompletion && ob.step > 0 ? (
          <Pressable
            style={[styles.outlineBtn, busy && styles.disabled]}
            onPress={onBack}
            disabled={busy}
          >
            <Text style={styles.outlineText}>{t("onboarding.back")}</Text>
          </Pressable>
        ) : (
          <View style={styles.footerSpacer} />
        )}
        <Pressable
          style={[
            styles.primaryBtn,
            (!isCompletion && !ob.canNext) || busy ? styles.disabled : null,
            !isCompletion && ob.step === 0 ? styles.primaryFull : null
          ]}
          onPress={() => {
            if (isCompletion) {
              completeMut.mutate();
            } else {
              onNext();
            }
          }}
          disabled={busy || (!isCompletion && !ob.canNext)}
        >
          {busy ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.primaryText}>
              {isCompletion
                ? t("onboarding.completion.cta")
                : t("onboarding.next")}
            </Text>
          )}
        </Pressable>
      </View>

      <SkipConfirmModal
        visible={skipModalOpen}
        onClose={() => setSkipModalOpen(false)}
        onContinueSetup={() => setSkipModalOpen(false)}
        onSkipAnyway={() => {
          setSkipModalOpen(false);
          skipMut.mutate();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.canvas },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  skipTop: {
    alignItems: "flex-end",
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    minHeight: 36
  },
  skipTopText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg
  },
  footer: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  footerSpacer: { width: 0 },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  outlineText: { fontWeight: "600", color: mobileColors.textPrimary },
  primaryBtn: {
    flex: 2,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryFull: { flex: 1 },
  primaryText: {
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: mobileFontSize.lg
  },
  disabled: { opacity: 0.5 }
});
