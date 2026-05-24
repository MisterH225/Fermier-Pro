import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkipConfirmModal } from "../../../components/onboarding/SkipConfirmModal";
import { useSession } from "../../../context/SessionContext";
import { upsertVetProfile } from "../../../lib/api";
import { formatAuthError } from "../../../lib/authErrors";
import { pickNonVetFallbackProfileId } from "../../../lib/vetOnboardingState";
import { getSupabase } from "../../../lib/supabase";
import { uploadVetDiplomaToSupabase } from "../../../lib/uploadVetDiplomaToSupabase";
import { uploadUserAvatarToSupabase } from "../../../lib/uploadAvatarToSupabase";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

const SPECIALTIES = [
  { key: "porcin", labelKey: "vetOnboarding.specialty.porcin" },
  { key: "bovin", labelKey: "vetOnboarding.specialty.bovin" },
  { key: "volaille", labelKey: "vetOnboarding.specialty.volaille" },
  { key: "general", labelKey: "vetOnboarding.specialty.general" },
  { key: "autre", labelKey: "vetOnboarding.specialty.other" }
] as const;

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

export function VetOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, setActiveProfileId } =
    useSession();
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
  const [otherSpecialties, setOtherSpecialties] = useState<string[]>([]);
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
  const [availability, setAvailability] = useState(true);
  const [radiusKm, setRadiusKm] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const pickDiploma = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("", t("vetOnboarding.diplomaPermission"));
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
      Alert.alert("", t("vetOnboarding.cancelNoProfile"));
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

  const onSubmit = async () => {
    if (!accessToken || !diplomaUri) {
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      if (!supabase || !authMe?.user.id) {
        throw new Error(t("vetOnboarding.uploadError"));
      }
      const diplomaUrl = await uploadVetDiplomaToSupabase(
        supabase,
        authMe.user.id,
        diplomaUri,
        diplomaMime
      );
      let profilePhotoUrl: string | undefined;
      if (avatarUri && authMe.user.supabaseUserId) {
        profilePhotoUrl = await uploadUserAvatarToSupabase(
          supabase,
          authMe.user.supabaseUserId,
          avatarUri,
          "image/jpeg"
        );
      }
      const year = Number.parseInt(graduationYear, 10);
      await upsertVetProfile(
        accessToken,
        {
          fullName: fullName.trim(),
          orderNumber: orderNumber.trim(),
          primarySpecialty,
          otherSpecialties,
          locationCity: locationCity.trim(),
          locationCountry: locationCountry.trim(),
          professionalPhone: phone.trim(),
          schoolName: schoolName.trim(),
          schoolCountry: schoolCountry.trim(),
          graduationYear: year,
          diplomaPhotoUrl: diplomaUrl,
          profilePhotoUrl,
          bio: bio.trim() || undefined,
          availability,
          interventionRadiusKm: radiusKm.trim()
            ? Number.parseInt(radiusKm, 10)
            : undefined
        },
        activeProfileId
      );
      await refreshAuthMe();
      setStep(3);
    } catch (e: unknown) {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 3) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.completion}>
          <Text style={styles.completionEmoji}>⏳</Text>
          <Text style={styles.completionTitle}>
            {t("vetOnboarding.completionTitle")}
          </Text>
          <Text style={styles.completionBody}>
            {t("vetOnboarding.completionBody")}
          </Text>
          <Pressable style={styles.cta} onPress={onFinished}>
            <Text style={styles.ctaTx}>{t("vetOnboarding.completionCta")}</Text>
          </Pressable>
        </View>
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
        <Text style={styles.stepLabel}>
          {t("vetOnboarding.step", { current: step + 1, total: 3 })}
        </Text>

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
            <Text style={styles.section}>{t("vetOnboarding.step3Title")}</Text>
            <Pressable style={styles.diplomaBtn} onPress={() => void pickAvatar()}>
              <Text style={styles.diplomaBtnTx}>
                {avatarUri
                  ? t("vetOnboarding.photoSelected")
                  : t("vetOnboarding.photoPick")}
              </Text>
            </Pressable>
            <Field label={t("vetOnboarding.bio")} value={bio} onChange={setBio} multiline />
            <View style={styles.switchRow}>
              <Text style={styles.lab}>{t("vetOnboarding.availability")}</Text>
              <Switch value={availability} onValueChange={setAvailability} />
            </View>
            <Field
              label={t("vetOnboarding.radius")}
              value={radiusKm}
              onChange={setRadiusKm}
              keyboardType="number-pad"
            />
          </>
        ) : null}

        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.back}>{t("vetOnboarding.back")}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={openCancelModal} disabled={busy || cancelBusy}>
              <Text style={styles.back}>{t("vetOnboarding.cancelLink")}</Text>
            </Pressable>
          )}
          {step < 2 ? (
            <Pressable
              style={[
                styles.cta,
                (step === 0 ? !step1Valid : !step2Valid) && styles.ctaDisabled
              ]}
              disabled={step === 0 ? !step1Valid : !step2Valid}
              onPress={() => setStep((s) => s + 1)}
            >
              <Text style={styles.ctaTx}>{t("vetOnboarding.next")}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.cta, busy && styles.ctaDisabled]}
              disabled={busy}
              onPress={() => void onSubmit()}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaTx}>{t("vetOnboarding.submit")}</Text>
              )}
            </Pressable>
          )}
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
  keyboardType
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "number-pad";
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
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  cancelTop: {
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.xs
  },
  cancelTopText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  scroll: { padding: mobileSpacing.lg, paddingBottom: 48 },
  head: {
    ...mobileTypography.sectionTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  stepLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.lg
  },
  rejected: {
    color: mobileColors.error,
    marginBottom: mobileSpacing.md,
    ...mobileTypography.body
  },
  section: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.md
  },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  inputMulti: { minHeight: 88, textAlignVertical: "top" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  pill: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}14`
  },
  pillTx: { fontSize: 13, color: mobileColors.textPrimary },
  diplomaBtn: {
    marginTop: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderStyle: "dashed",
    alignItems: "center"
  },
  diplomaBtnTx: { color: mobileColors.accent, fontWeight: "700" },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: mobileSpacing.md
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: mobileSpacing.xl
  },
  back: { color: mobileColors.textSecondary, fontWeight: "600" },
  cta: {
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.pill
  },
  ctaDisabled: { opacity: 0.45 },
  ctaTx: { color: "#fff", fontWeight: "700" },
  completion: {
    flex: 1,
    justifyContent: "center",
    padding: mobileSpacing.xl,
    alignItems: "center"
  },
  completionEmoji: { fontSize: 48, marginBottom: mobileSpacing.md },
  completionTitle: {
    ...mobileTypography.sectionTitle,
    textAlign: "center",
    color: mobileColors.textPrimary
  },
  completionBody: {
    ...mobileTypography.body,
    textAlign: "center",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xl
  }
});
