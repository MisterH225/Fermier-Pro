import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ProfileHeroCard,
  profileScreenScrollContent,
  ScreenSection
} from "../../../components/layout";
import { useSession } from "../../../context/SessionContext";
import { patchAuthProfile, upsertBuyerProfile } from "../../../lib/api";
import { formatApiError } from "../../../lib/apiErrors";
import { pickNonBuyerFallbackProfileId } from "../../../lib/buyerOnboardingState";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { buyerColors } from "../../../theme/buyerTheme";

const BUYER_TYPES = ["individual", "slaughterhouse", "wholesaler", "reseller", "other"] as const;
const CATEGORIES = ["piglet", "breeder_male", "breeder_female", "butcher", "reformed"] as const;
const VOLUMES = ["1-5", "5-20", "20-50", "50+"] as const;

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

export function BuyerOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, setActiveProfileId } =
    useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(authMe?.user.fullName ?? "");
  const [buyerType, setBuyerType] = useState<string>("individual");
  const [locationLabel, setLocationLabel] = useState(authMe?.user.homeLocationLabel ?? "");
  const [phone, setPhone] = useState(authMe?.user.phone ?? "");
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [typicalVolume, setTypicalVolume] = useState<string>(VOLUMES[0]);

  const toggleCat = (c: string) => {
    setPreferredCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const submit = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const parts = fullName.trim().split(/\s+/);
      await patchAuthProfile(
        accessToken,
        {
          firstName: parts[0] || undefined,
          lastName: parts.slice(1).join(" ") || undefined,
          homeLocationLabel: locationLabel.trim() || undefined
        },
        activeProfileId
      );
      await upsertBuyerProfile(accessToken, activeProfileId, {
        buyerType,
        locationLabel: locationLabel.trim(),
        preferredCategories,
        typicalVolume,
        onboardingComplete: true
      });
      await refreshAuthMe();
      onFinished();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onSkipProfile = async () => {
    const fallback = authMe ? pickNonBuyerFallbackProfileId(authMe, activeProfileId) : null;
    if (fallback) {
      await setActiveProfileId(fallback);
    }
    onCancel();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={profileScreenScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => void onSkipProfile()} style={styles.skip}>
          <Text style={styles.skipText}>{t("buyerOnboarding.skip")}</Text>
        </Pressable>

        {step === 0 ? (
          <>
            <ProfileHeroCard>
              <Text style={styles.heroTitle}>{t("buyerOnboarding.step1Title")}</Text>
            </ProfileHeroCard>
            <ScreenSection title={t("buyerOnboarding.sectionIdentity")}>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t("buyerOnboarding.fullName")}
                placeholderTextColor={buyerColors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.inputSpaced]}
                value={locationLabel}
                onChangeText={setLocationLabel}
                placeholder={t("buyerOnboarding.location")}
                placeholderTextColor={buyerColors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.inputSpaced]}
                value={phone}
                onChangeText={setPhone}
                placeholder={t("buyerOnboarding.phone")}
                keyboardType="phone-pad"
                placeholderTextColor={buyerColors.textMuted}
              />
            </ScreenSection>
            <ScreenSection title={t("buyerOnboarding.sectionType")}>
              <View style={styles.chips}>
                {BUYER_TYPES.map((bt) => (
                  <Pressable
                    key={bt}
                    style={[styles.chip, buyerType === bt && styles.chipActive]}
                    onPress={() => setBuyerType(bt)}
                  >
                    <Text style={[styles.chipText, buyerType === bt && styles.chipTextActive]}>
                      {t(`buyerOnboarding.type.${bt}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScreenSection>
            <Pressable
              style={[styles.primary, (!fullName.trim() || !locationLabel.trim()) && styles.primaryDisabled]}
              onPress={() => setStep(1)}
              disabled={!fullName.trim() || !locationLabel.trim()}
            >
              <Text style={styles.primaryLabel}>{t("buyerOnboarding.continue")}</Text>
            </Pressable>
          </>
        ) : step === 1 ? (
          <>
            <ProfileHeroCard>
              <Text style={styles.heroTitle}>{t("buyerOnboarding.step2Title")}</Text>
            </ProfileHeroCard>
            <ScreenSection title={t("buyerOnboarding.sectionCategories")}>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, preferredCategories.includes(c) && styles.chipActive]}
                    onPress={() => toggleCat(c)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        preferredCategories.includes(c) && styles.chipTextActive
                      ]}
                    >
                      {t(`buyerOnboarding.cat.${c}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScreenSection>
            <ScreenSection title={t("buyerOnboarding.volume")}>
              <View style={styles.chips}>
                {VOLUMES.map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.chip, typicalVolume === v && styles.chipActive]}
                    onPress={() => setTypicalVolume(v)}
                  >
                    <Text style={[styles.chipText, typicalVolume === v && styles.chipTextActive]}>
                      {t(`buyerOnboarding.vol.${v}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScreenSection>
            <Pressable style={styles.primary} onPress={() => setStep(2)}>
              <Text style={styles.primaryLabel}>{t("buyerOnboarding.continue")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ProfileHeroCard>
              <Text style={styles.heroTitle}>{t("buyerOnboarding.doneTitle")}</Text>
              <Text style={styles.heroBody}>{t("buyerOnboarding.doneBody")}</Text>
            </ProfileHeroCard>
            {error ? (
              <ScreenSection title={t("buyerOnboarding.sectionError")}>
                <Text style={styles.error}>{error}</Text>
              </ScreenSection>
            ) : null}
            <Pressable style={styles.primary} onPress={() => void submit()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryLabel}>{t("buyerOnboarding.doneCta")}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: buyerColors.canvas },
  skip: { alignSelf: "flex-end" },
  skipText: { color: buyerColors.primary, fontWeight: "600" },
  heroTitle: { ...mobileTypography.cardTitle, fontSize: 22, color: buyerColors.textPrimary },
  heroBody: { ...mobileTypography.body, color: buyerColors.textSecondary, lineHeight: 22 },
  input: {
    backgroundColor: buyerColors.canvas,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    ...mobileTypography.body,
    color: buyerColors.textPrimary
  },
  inputSpaced: { marginTop: mobileSpacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: buyerColors.border,
    backgroundColor: buyerColors.cardBg
  },
  chipActive: { backgroundColor: buyerColors.primary, borderColor: buyerColors.primary },
  chipText: { ...mobileTypography.meta, fontWeight: "600", color: buyerColors.textSecondary },
  chipTextActive: { color: "#fff" },
  primary: {
    backgroundColor: buyerColors.primary,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    alignItems: "center"
  },
  primaryDisabled: { opacity: 0.5 },
  primaryLabel: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: mobileColors.error }
});
