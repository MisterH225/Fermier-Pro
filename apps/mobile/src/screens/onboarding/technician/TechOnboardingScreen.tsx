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
import { useSession } from "../../../context/SessionContext";
import { patchAuthProfile, upsertTechnicianProfile } from "../../../lib/api";
import { formatApiError } from "../../../lib/apiErrors";
import { pickNonTechnicianFallbackProfileId } from "../../../lib/techOnboardingState";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { techColors } from "../../../theme/technicianTheme";

const EXPERIENCE = ["<1", "1-3", "3-5", "5-10", "10+"] as const;
const SPECS = ["feed", "health", "repro", "herd", "all"] as const;

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

export function TechOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, setActiveProfileId } =
    useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(
    authMe?.user.fullName?.trim() ||
      [authMe?.user.firstName, authMe?.user.lastName].filter(Boolean).join(" ")
  );
  const [phone, setPhone] = useState(authMe?.user.phone ?? "");
  const [experienceYears, setExperienceYears] = useState<string>(EXPERIENCE[1]);
  const [specializations, setSpecializations] = useState<string[]>(["all"]);
  const [formation, setFormation] = useState("");

  const toggleSpec = (key: string) => {
    setSpecializations((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
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
          lastName: parts.slice(1).join(" ") || undefined
        },
        activeProfileId
      );
      await upsertTechnicianProfile(accessToken, activeProfileId, {
        experienceYears,
        specializations,
        formation: formation.trim() || undefined,
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
    const fallback = authMe ? pickNonTechnicianFallbackProfileId(authMe, activeProfileId) : null;
    if (fallback) {
      await setActiveProfileId(fallback);
    }
    onCancel();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => void onSkipProfile()} style={styles.skip}>
          <Text style={styles.skipText}>{t("techOnboarding.skip")}</Text>
        </Pressable>

        {step === 0 ? (
          <>
            <Text style={styles.title}>{t("techOnboarding.step1Title")}</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder={t("techOnboarding.fullName")} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={t("techOnboarding.phone")} keyboardType="phone-pad" />
            <Pressable style={styles.primary} onPress={() => setStep(1)} disabled={!fullName.trim()}>
              <Text style={styles.primaryLabel}>{t("techOnboarding.continue")}</Text>
            </Pressable>
          </>
        ) : step === 1 ? (
          <>
            <Text style={styles.title}>{t("techOnboarding.step2Title")}</Text>
            <Text style={styles.label}>{t("techOnboarding.experience")}</Text>
            <View style={styles.chips}>
              {EXPERIENCE.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.chip, experienceYears === e && styles.chipActive]}
                  onPress={() => setExperienceYears(e)}
                >
                  <Text style={[styles.chipText, experienceYears === e && styles.chipTextActive]}>
                    {t(`techOnboarding.exp.${e}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{t("techOnboarding.specializations")}</Text>
            <View style={styles.chips}>
              {SPECS.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, specializations.includes(s) && styles.chipActive]}
                  onPress={() => toggleSpec(s)}
                >
                  <Text style={[styles.chipText, specializations.includes(s) && styles.chipTextActive]}>
                    {t(`techOnboarding.spec.${s}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} value={formation} onChangeText={setFormation} placeholder={t("techOnboarding.formation")} />
            <Pressable style={styles.primary} onPress={() => setStep(2)} disabled={busy}>
              <Text style={styles.primaryLabel}>{t("techOnboarding.continue")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>{t("techOnboarding.doneTitle")}</Text>
            <Text style={styles.body}>{t("techOnboarding.doneBody")}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primary} onPress={() => void submit()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryLabel}>{t("techOnboarding.doneCta")}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: techColors.canvas },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  skip: { alignSelf: "flex-end" },
  skipText: { color: techColors.primary, fontWeight: "600" },
  title: { ...mobileTypography.cardTitle, fontSize: 22, color: techColors.textPrimary },
  body: { ...mobileTypography.body, color: techColors.textSecondary, lineHeight: 22 },
  label: { ...mobileTypography.meta, color: techColors.textSecondary, marginTop: mobileSpacing.sm },
  input: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    ...mobileTypography.body
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: techColors.border,
    backgroundColor: techColors.cardBg
  },
  chipActive: { backgroundColor: techColors.primary, borderColor: techColors.primary },
  chipText: { ...mobileTypography.meta, fontWeight: "600", color: techColors.textSecondary },
  chipTextActive: { color: "#fff" },
  primary: {
    marginTop: mobileSpacing.lg,
    backgroundColor: techColors.primary,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    alignItems: "center"
  },
  primaryLabel: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: mobileColors.error }
});
