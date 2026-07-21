import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileCompletionGauge } from "../../../components/common/ProfileCompletionGauge";
import { vetPalette } from "../../../components/common/rolePalette";
import { SkipConfirmModal } from "../../../components/onboarding/SkipConfirmModal";
import { useSession } from "../../../context/SessionContext";
import {
  patchAuthProfile,
  patchVetPublicProfile,
  upsertVetProfile
} from "../../../lib/api";
import { formatApiError } from "../../../lib/apiErrors";
import { formatAuthError } from "../../../lib/authErrors";
import { getSupabase } from "../../../lib/supabase";
import { uploadUserAvatarToSupabase } from "../../../lib/uploadAvatarToSupabase";
import { uploadVetDiplomaToSupabase } from "../../../lib/uploadVetDiplomaToSupabase";
import { pickNonVetFallbackProfileId } from "../../../lib/vetOnboardingState";
import { vetProfileFromOnboarding } from "../../../lib/vetOnboardingSnapshot";
import {
  vetProfileCompletionPercent,
  vetProfileNextEmptyField
} from "../../../lib/vetProfileCompletion";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { vetColors, vetRadius } from "../../../theme/vetTheme";

const SPECIALTIES = [
  { key: "porcin", labelKey: "vetOnboarding.specialty.porcin" },
  { key: "bovin", labelKey: "vetOnboarding.specialty.bovin" },
  { key: "volaille", labelKey: "vetOnboarding.specialty.volaille" },
  { key: "general", labelKey: "vetOnboarding.specialty.general" },
  { key: "autre", labelKey: "vetOnboarding.specialty.other" }
] as const;

const RADIUS_PRESETS = [10, 25, 50, 100] as const;

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

/**
 * Étapes 0–1 : vérification (ordre, diplôme) — inchangées.
 * Après soumission (pending) : vitrine (bio, spécialités, rayon) puis récap jauge.
 */
export function VetOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, setActiveProfileId } =
    useSession();
  /** 0–1 vérification · 2 vitrine · 3 final */
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const [fullName, setFullName] = useState(
    authMe?.user.fullName?.trim() ||
      [authMe?.user.firstName, authMe?.user.lastName].filter(Boolean).join(" ")
  );
  const [orderNumber, setOrderNumber] = useState("");
  const [primarySpecialty, setPrimarySpecialty] = useState("porcin");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [phone, setPhone] = useState(authMe?.user.phone ?? "");

  const [schoolName, setSchoolName] = useState("");
  const [schoolCountry, setSchoolCountry] = useState("");
  const [graduationYear, setGraduationYear] = useState(
    String(new Date().getFullYear())
  );
  const [diplomaUri, setDiplomaUri] = useState<string | null>(null);
  const [diplomaMime, setDiplomaMime] = useState("image/jpeg");

  const [bio, setBio] = useState("");
  const [otherSpecialties, setOtherSpecialties] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState<number | null>(25);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  const pickDiploma = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.accessDeniedTitle"), t("vetOnboarding.diplomaPermission"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85
    });
    if (!res.canceled && res.assets[0]) {
      setDiplomaUri(res.assets[0].uri);
      setDiplomaMime(res.assets[0].mimeType ?? "image/jpeg");
    }
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82
    });
    if (!res.canceled && res.assets[0]) {
      setAvatarUri(res.assets[0].uri);
    }
  };

  const step1Valid =
    fullName.trim().length >= 2 &&
    orderNumber.trim().length >= 2 &&
    locationCity.trim().length >= 2 &&
    locationCountry.trim().length >= 2 &&
    phone.trim().length >= 6;

  const step2Valid =
    schoolName.trim().length >= 2 &&
    schoolCountry.trim().length >= 2 &&
    graduationYear.trim().length === 4 &&
    Boolean(diplomaUri);

  const snapshot = useMemo(
    () =>
      vetProfileFromOnboarding({
        bio,
        otherSpecialties,
        interventionRadiusKm: radiusKm,
        profilePhotoUrl: profilePhotoUrl ?? (avatarUri ? "pending" : null),
        availability: true
      }),
    [bio, otherSpecialties, radiusKm, profilePhotoUrl, avatarUri]
  );

  const completion = vetProfileCompletionPercent(snapshot);
  const nextField = vetProfileNextEmptyField(snapshot);
  const nextHint = nextField
    ? t(`vet.account.nextField.${nextField}`)
    : null;

  const toggleSecondary = (key: string) => {
    if (key === primarySpecialty) return;
    setOtherSpecialties((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const openCancelModal = () => {
    if (busy || cancelBusy) {
      return;
    }
    setCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!authMe) {
      return;
    }
    const fallbackId = pickNonVetFallbackProfileId(authMe, activeProfileId);
    if (!fallbackId) {
      setCancelModalOpen(false);
      Alert.alert(t("common.infoTitle"), t("vetOnboarding.cancelNoProfile"));
      return;
    }
    setCancelBusy(true);
    try {
      await setActiveProfileId(fallbackId);
      setCancelModalOpen(false);
      onCancel();
    } catch (e: unknown) {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    } finally {
      setCancelBusy(false);
    }
  };

  /** Soumission vérification uniquement (sans vitrine). */
  const onSubmitVerification = async () => {
    if (!accessToken || !diplomaUri) {
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const storageOwnerId = authMe?.user.supabaseUserId;
      if (!supabase || !storageOwnerId) {
        throw new Error(t("vetOnboarding.uploadError"));
      }
      const diplomaUrl = await uploadVetDiplomaToSupabase(
        supabase,
        storageOwnerId,
        diplomaUri,
        diplomaMime
      );
      const year = Number.parseInt(graduationYear, 10);
      await upsertVetProfile(
        accessToken,
        {
          fullName: fullName.trim(),
          orderNumber: orderNumber.trim(),
          primarySpecialty,
          otherSpecialties: [],
          locationCity: locationCity.trim(),
          locationCountry: locationCountry.trim(),
          professionalPhone: phone.trim(),
          schoolName: schoolName.trim(),
          schoolCountry: schoolCountry.trim(),
          graduationYear: year,
          diplomaPhotoUrl: diplomaUrl,
          availability: true
        },
        activeProfileId
      );
      await refreshAuthMe();
      setStep(2);
    } catch (e: unknown) {
      Alert.alert(t("health.errorTitle"), formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveVitrine = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const supabase = getSupabase();
      let photoUrl = profilePhotoUrl ?? undefined;
      if (avatarUri && authMe?.user.supabaseUserId && supabase) {
        photoUrl = await uploadUserAvatarToSupabase(
          supabase,
          authMe.user.supabaseUserId,
          avatarUri,
          "image/jpeg",
          "veterinarian"
        );
        setProfilePhotoUrl(photoUrl);
        await patchAuthProfile(
          accessToken,
          { avatarUrl: photoUrl },
          activeProfileId
        );
      }
      await patchVetPublicProfile(
        accessToken,
        {
          bio: bio.trim() || undefined,
          otherSpecialties,
          interventionRadiusKm: radiusKm ?? undefined,
          availability: true,
          profilePhotoUrl: photoUrl
        },
        activeProfileId
      );
      await refreshAuthMe();
      setStep(3);
    } catch (e: unknown) {
      Alert.alert(t("health.errorTitle"), formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 3) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.completion}>
          <Text style={styles.completionTitle}>
            {t("vetOnboarding.finalTitle")}
          </Text>
          <Text style={styles.completionBody}>
            {t("vetOnboarding.finalBody")}
          </Text>
          <ProfileCompletionGauge
            percent={completion}
            palette={vetPalette}
            label={t("vet.account.completionLabel")}
            hint={nextHint}
            animated
          />
          <Text style={styles.howtoTitle}>
            {t("vetOnboarding.howtoTitle")}
          </Text>
          <Text style={styles.howtoItem}>{t("vetOnboarding.howtoSearch")}</Text>
          <Text style={styles.howtoItem}>{t("vetOnboarding.howtoAppointments")}</Text>
          <Text style={styles.howtoItem}>{t("vetOnboarding.howtoIncome")}</Text>
          <Text style={styles.pendingNote}>
            {t("vetOnboarding.completionBody")}
          </Text>
          <Pressable style={styles.cta} onPress={onFinished}>
            <Text style={styles.ctaTx}>{t("vetOnboarding.completionCta")}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Pressable
        style={styles.cancelTop}
        onPress={openCancelModal}
        disabled={busy || cancelBusy}
      >
        <Text style={styles.cancelTopText}>{t("vetOnboarding.cancelLink")}</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.head}>{t("vetOnboarding.title")}</Text>
        {authMe?.vetProfessional?.verificationStatus === "rejected" ? (
          <Text style={styles.rejected}>
            {t("vetOnboarding.rejected", {
              reason:
                authMe.vetProfessional.rejectionReason ??
                t("vetOnboarding.rejectedGeneric")
            })}
          </Text>
        ) : null}

        {step <= 1 ? (
          <Text style={styles.stepLabel}>
            {t("vetOnboarding.step", { current: step + 1, total: 2 })}
          </Text>
        ) : (
          <Text style={styles.stepLabel}>
            {t("vetOnboarding.vitrineStepLabel")}
          </Text>
        )}

        {step === 0 ? (
          <>
            <Text style={styles.section}>{t("vetOnboarding.step1Title")}</Text>
            <Field label={t("vetOnboarding.fullName")} value={fullName} onChange={setFullName} />
            <Field
              label={t("vetOnboarding.orderNumber")}
              value={orderNumber}
              onChange={setOrderNumber}
            />
            <Text style={styles.lab}>{t("vetOnboarding.primarySpecialty")}</Text>
            <View style={styles.pills}>
              {SPECIALTIES.map((s) => (
                <Pressable
                  key={s.key}
                  style={[styles.pill, primarySpecialty === s.key && styles.pillOn]}
                  onPress={() => setPrimarySpecialty(s.key)}
                >
                  <Text style={styles.pillTx}>{t(s.labelKey)}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              label={t("vetOnboarding.locationCity")}
              value={locationCity}
              onChange={setLocationCity}
            />
            <Field
              label={t("vetOnboarding.locationCountry")}
              value={locationCountry}
              onChange={setLocationCountry}
            />
            <Field
              label={t("vetOnboarding.phone")}
              value={phone}
              onChange={setPhone}
              keyboardType="phone-pad"
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.section}>{t("vetOnboarding.step2Title")}</Text>
            <Field label={t("vetOnboarding.school")} value={schoolName} onChange={setSchoolName} />
            <Field
              label={t("vetOnboarding.schoolCountry")}
              value={schoolCountry}
              onChange={setSchoolCountry}
            />
            <Field
              label={t("vetOnboarding.graduationYear")}
              value={graduationYear}
              onChange={setGraduationYear}
              keyboardType="number-pad"
            />
            <Pressable style={styles.diplomaBtn} onPress={() => void pickDiploma()}>
              <Text style={styles.diplomaBtnTx}>
                {diplomaUri
                  ? t("vetOnboarding.diplomaSelected")
                  : t("vetOnboarding.diplomaPick")}
              </Text>
            </Pressable>
            <Text style={styles.hint}>{t("vetOnboarding.diplomaHint")}</Text>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.section}>{t("vetOnboarding.vitrineTitle")}</Text>
            <Text style={styles.vitrineLead}>
              {t("vetOnboarding.vitrineLead")}
            </Text>
            <Field
              label={t("vetOnboarding.bio")}
              value={bio}
              onChange={setBio}
              multiline
              placeholder={t("vetOnboarding.bioPlaceholder")}
            />
            <Text style={styles.lab}>{t("vetOnboarding.otherSpecialties")}</Text>
            <View style={styles.pills}>
              {SPECIALTIES.filter((s) => s.key !== primarySpecialty).map((s) => (
                <Pressable
                  key={s.key}
                  style={[
                    styles.pill,
                    otherSpecialties.includes(s.key) && styles.pillOn
                  ]}
                  onPress={() => toggleSecondary(s.key)}
                >
                  <Text style={styles.pillTx}>{t(s.labelKey)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.lab}>{t("vetOnboarding.radius")}</Text>
            <View style={styles.pills}>
              {RADIUS_PRESETS.map((km) => (
                <Pressable
                  key={km}
                  style={[styles.pill, radiusKm === km && styles.pillOn]}
                  onPress={() => setRadiusKm(km)}
                >
                  <Text style={styles.pillTx}>
                    {t("vetOnboarding.radiusKm", { km })}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.diplomaBtn} onPress={() => void pickAvatar()}>
              <Text style={styles.diplomaBtnTx}>
                {avatarUri
                  ? t("vetOnboarding.photoSelected")
                  : t("vetOnboarding.photoPick")}
              </Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.nav}>
          {step > 0 && step < 2 ? (
            <Pressable onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.back}>{t("vetOnboarding.back")}</Text>
            </Pressable>
          ) : step === 0 ? (
            <Pressable onPress={openCancelModal} disabled={busy || cancelBusy}>
              <Text style={styles.back}>{t("vetOnboarding.cancelLink")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setStep(3)}
              disabled={busy}
            >
              <Text style={styles.back}>{t("vetOnboarding.skipVitrine")}</Text>
            </Pressable>
          )}

          {step === 0 ? (
            <Pressable
              style={[styles.cta, !step1Valid && styles.ctaDisabled]}
              disabled={!step1Valid}
              onPress={() => setStep(1)}
            >
              <Text style={styles.ctaTx}>{t("vetOnboarding.next")}</Text>
            </Pressable>
          ) : null}

          {step === 1 ? (
            <Pressable
              style={[styles.cta, (!step2Valid || busy) && styles.ctaDisabled]}
              disabled={!step2Valid || busy}
              onPress={() => void onSubmitVerification()}
            >
              {busy ? (
                <ActivityIndicator color={mobileColors.onAccent} />
              ) : (
                <Text style={styles.ctaTx}>{t("vetOnboarding.submit")}</Text>
              )}
            </Pressable>
          ) : null}

          {step === 2 ? (
            <Pressable
              style={[styles.cta, busy && styles.ctaDisabled]}
              disabled={busy}
              onPress={() => void saveVitrine()}
            >
              {busy ? (
                <ActivityIndicator color={mobileColors.onAccent} />
              ) : (
                <Text style={styles.ctaTx}>{t("vetOnboarding.saveVitrine")}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <SkipConfirmModal
        visible={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onContinueSetup={() => setCancelModalOpen(false)}
        onSkipAnyway={() => void confirmCancel()}
        titleKey="vetOnboarding.cancelModal.title"
        messageKey="vetOnboarding.cancelModal.message"
        continueKey="vetOnboarding.cancelModal.continue"
        skipAnywayKey="vetOnboarding.cancelModal.confirm"
      />
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  placeholder?: string;
}) {
  return (
    <>
      <Text style={styles.lab}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={vetColors.textMuted}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: vetColors.canvas },
  cancelTop: {
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.xs
  },
  cancelTopText: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    fontWeight: "600"
  },
  scroll: { padding: mobileSpacing.lg, paddingBottom: 48 },
  head: {
    ...mobileTypography.sectionTitle,
    color: vetColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  stepLabel: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    marginBottom: mobileSpacing.lg
  },
  rejected: {
    color: vetColors.danger,
    marginBottom: mobileSpacing.md,
    ...mobileTypography.body
  },
  section: {
    ...mobileTypography.cardTitle,
    color: vetColors.textPrimary,
    marginBottom: mobileSpacing.md
  },
  vitrineLead: {
    ...mobileTypography.body,
    color: vetColors.textSecondary,
    marginBottom: mobileSpacing.md,
    lineHeight: 22
  },
  lab: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    marginTop: mobileSpacing.sm,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: vetColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    color: vetColors.textPrimary,
    backgroundColor: vetColors.cardBg
  },
  inputMulti: { minHeight: 88, textAlignVertical: "top" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  pill: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: vetRadius.pill,
    borderWidth: 1,
    borderColor: vetColors.border,
    backgroundColor: vetColors.cardBg
  },
  pillOn: {
    borderColor: vetColors.primary,
    backgroundColor: vetColors.primaryLight
  },
  pillTx: { fontSize: mobileFontSize.sm, color: vetColors.textPrimary },
  diplomaBtn: {
    marginTop: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: vetColors.primary,
    borderStyle: "dashed",
    alignItems: "center"
  },
  diplomaBtnTx: { color: vetColors.primary, fontWeight: "700" },
  hint: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: mobileSpacing.xl
  },
  back: { color: vetColors.textSecondary, fontWeight: "600" },
  cta: {
    backgroundColor: vetColors.primary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: vetRadius.pill
  },
  ctaDisabled: { opacity: 0.45 },
  ctaTx: { color: vetColors.onPrimary, fontWeight: "700" },
  completion: {
    padding: mobileSpacing.xl,
    gap: mobileSpacing.md,
    paddingBottom: 48
  },
  completionTitle: {
    ...mobileTypography.sectionTitle,
    textAlign: "center",
    color: vetColors.textPrimary
  },
  completionBody: {
    ...mobileTypography.body,
    textAlign: "center",
    color: vetColors.textSecondary
  },
  howtoTitle: {
    ...mobileTypography.cardTitle,
    color: vetColors.textPrimary,
    marginTop: mobileSpacing.md
  },
  howtoItem: {
    ...mobileTypography.body,
    color: vetColors.textSecondary,
    lineHeight: 22
  },
  pendingNote: {
    ...mobileTypography.meta,
    color: vetColors.textMuted,
    textAlign: "center",
    marginTop: mobileSpacing.sm
  }
});
