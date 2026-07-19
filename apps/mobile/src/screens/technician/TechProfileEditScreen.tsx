import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { CardContentSkeleton } from "../../components/common/SkeletonBlocks";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { useSession } from "../../context/SessionContext";
import {
  fetchTechnicianProfile,
  patchAuthProfile,
  upsertTechnicianProfile,
  type TechnicianFormationType
} from "../../lib/api";
import { getSupabase } from "../../lib/supabase";
import { uploadUserAvatarToSupabase } from "../../lib/uploadAvatarToSupabase";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { techColors } from "../../theme/technicianTheme";
import { getQueryErrorMessage, getUserFacingError } from "../../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "TechProfileEdit">;

const AVATAR = 96;

const FORMATION_OPTIONS: { value: TechnicianFormationType; label: string }[] =
  [
    { value: "diplome", label: "🎓 Diplôme" },
    { value: "formation_courte", label: "📚 Formation courte" },
    { value: "sur_le_tas", label: "🔧 Sur le tas" },
    { value: "autodidacte", label: "🌱 Autodidacte" }
  ];

const SPEC_OPTIONS = [
  "Alimentation",
  "Santé animale",
  "Reproduction",
  "Gestion cheptel",
  "Bâtiments / Infrastructure",
  "Tout terrain"
];

export function TechProfileEditScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["techProfile", activeProfileId],
    queryFn: () => fetchTechnicianProfile(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const [formationType, setFormationType] =
    useState<TechnicianFormationType | null>(null);
  const [formationDetails, setFormationDetails] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [experienceYearsCount, setExperienceYearsCount] = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [bio, setBio] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [pretension, setPretension] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    const p = profileQ.data;
    if (!p) return;
    setFormationType(p.formationType);
    setFormationDetails(p.formationDetails ?? "");
    setGraduationYear(p.graduationYear ? String(p.graduationYear) : "");
    setExperienceYearsCount(
      p.experienceYearsCount != null ? String(p.experienceYearsCount) : ""
    );
    setSpecializations(p.specializations ?? []);
    setLocationCity(p.locationCity ?? "");
    setLocationCountry(p.locationCountry ?? "");
    setBio(p.bio ?? "");
    setIsAvailable(p.isAvailable);
    setAvailabilityNote(p.availabilityNote ?? "");
    setPretension(
      p.pretensionSalarialeMensuelle != null
        ? String(p.pretensionSalarialeMensuelle)
        : ""
    );
    setIsPublic(p.isPublic);
    setProfilePhotoUrl(p.profilePhotoUrl);
    setPendingPhotoUri(null);
  }, [profileQ.data]);

  const displayPhotoUri = pendingPhotoUri ?? profilePhotoUrl;

  const pickImage = async (source: "library" | "camera") => {
    const perm =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result =
      source === "library"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85
          });
    if (!result.canceled && result.assets[0]?.uri) {
      setPendingPhotoUri(result.assets[0].uri);
    }
  };

  const openPhotoMenu = () => {
    Alert.alert(
      t("tech.profileEdit.changePhoto"),
      t("tech.profileEdit.changePhotoMessage"),
      [
        {
          text: t("tech.profileEdit.pickGallery"),
          onPress: () => void pickImage("library")
        },
        {
          text: t("tech.profileEdit.pickCamera"),
          onPress: () => void pickImage("camera")
        },
        { text: t("producer.cancelPhoto"), style: "cancel" }
      ]
    );
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      let nextPhotoUrl = profilePhotoUrl;
      let photoChanged = false;
      if (pendingPhotoUri) {
        const supabase = getSupabase();
        if (!supabase || !authMe?.user.supabaseUserId) {
          throw new Error(t("tech.profileEdit.photoUploadError"));
        }
        const mime =
          pendingPhotoUri.toLowerCase().includes("png") ||
          pendingPhotoUri.endsWith(".png")
            ? "image/png"
            : "image/jpeg";
        nextPhotoUrl = await uploadUserAvatarToSupabase(
          supabase,
          authMe.user.supabaseUserId,
          pendingPhotoUri,
          mime,
          "technician"
        );
        photoChanged = true;
      }

      await upsertTechnicianProfile(accessToken!, activeProfileId, {
        formationType: formationType ?? undefined,
        formationDetails: formationDetails.trim() || undefined,
        graduationYear: graduationYear
          ? Number.parseInt(graduationYear, 10)
          : undefined,
        experienceYearsCount: experienceYearsCount
          ? Number.parseInt(experienceYearsCount, 10)
          : undefined,
        specializations,
        locationCity: locationCity.trim(),
        locationCountry: locationCountry.trim(),
        bio: bio.trim() || undefined,
        isAvailable,
        availabilityNote: availabilityNote.trim() || undefined,
        pretensionSalarialeMensuelle: pretension
          ? Number.parseFloat(pretension)
          : null,
        isPublic,
        profilePhotoUrl: nextPhotoUrl ?? undefined
      });

      // Dashboard / menu profil lisent Profile.avatarUrl via authMe — sync comme véto / producteur.
      if (photoChanged && nextPhotoUrl) {
        await patchAuthProfile(
          accessToken!,
          { avatarUrl: nextPhotoUrl },
          activeProfileId
        );
        await refreshAuthMe();
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["techProfile"] });
      void qc.invalidateQueries({ queryKey: ["technicianSearch"] });
      navigation.goBack();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  const photoSection = useMemo(
    () => (
      <View style={styles.photoRow}>
        <Pressable
          onPress={openPhotoMenu}
          style={styles.avatarWrap}
          accessibilityRole="button"
          accessibilityLabel={t("tech.profileEdit.changePhoto")}
        >
          {displayPhotoUri ? (
            <Image source={{ uri: displayPhotoUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <Ionicons name="construct" size={40} color={techColors.primary} />
            </View>
          )}
          <View style={styles.pencilFab}>
            <Ionicons name="pencil" size={16} color={mobileColors.onAccent} />
          </View>
        </Pressable>
        <Text style={styles.photoHint}>{t("tech.profileEdit.changePhoto")}</Text>
      </View>
    ),
    [displayPhotoUri, t]
  );

  if (profileQ.isPending) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarSkeleton} />
        <CardContentSkeleton lines={6} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {photoSection}
      <Text style={styles.section}>{t("tech.profileEdit.identity")}</Text>
      <TextInput
        style={styles.input}
        value={locationCity}
        onChangeText={setLocationCity}
        placeholder={t("tech.profileEdit.city")}
      />
      <TextInput
        style={styles.input}
        value={locationCountry}
        onChangeText={setLocationCountry}
        placeholder={t("tech.profileEdit.country")}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        placeholder={t("tech.profileEdit.bioPh")}
        maxLength={150}
        multiline
      />

      <Text style={styles.section}>{t("tech.profileEdit.experience")}</Text>
      <View style={styles.pills}>
        {FORMATION_OPTIONS.map((o) => (
          <Text
            key={o.value}
            style={[
              styles.pill,
              formationType === o.value && styles.pillActive
            ]}
            onPress={() => setFormationType(o.value)}
          >
            {o.label}
          </Text>
        ))}
      </View>
      {(formationType === "diplome" ||
        formationType === "formation_courte") && (
        <>
          <TextInput
            style={styles.input}
            value={formationDetails}
            onChangeText={setFormationDetails}
            placeholder={t("tech.profileEdit.formationDetails")}
          />
          <TextInput
            style={styles.input}
            value={graduationYear}
            onChangeText={setGraduationYear}
            placeholder={t("tech.profileEdit.graduationYear")}
            keyboardType="number-pad"
          />
        </>
      )}
      <TextInput
        style={styles.input}
        value={experienceYearsCount}
        onChangeText={setExperienceYearsCount}
        placeholder={t("tech.profileEdit.experienceYears")}
        keyboardType="number-pad"
      />
      <View style={styles.pills}>
        {SPEC_OPTIONS.map((s) => {
          const on = specializations.includes(s);
          return (
            <Text
              key={s}
              style={[styles.pill, on && styles.pillActive]}
              onPress={() =>
                setSpecializations((prev) =>
                  on ? prev.filter((x) => x !== s) : [...prev, s]
                )
              }
            >
              {s}
            </Text>
          );
        })}
      </View>

      <Text style={styles.section}>{t("tech.profileEdit.availability")}</Text>
      <View style={styles.row}>
        <Text>{t("tech.profileEdit.available")}</Text>
        <Switch value={isAvailable} onValueChange={setIsAvailable} />
      </View>
      <TextInput
        style={styles.input}
        value={availabilityNote}
        onChangeText={setAvailabilityNote}
        placeholder={t("tech.profileEdit.availabilityNote")}
      />
      <TextInput
        style={styles.input}
        value={pretension}
        onChangeText={setPretension}
        placeholder={t("tech.profileEdit.pretension")}
        keyboardType="numeric"
      />

      <Text style={styles.section}>{t("tech.profileEdit.visibility")}</Text>
      <View style={styles.row}>
        <Text>{t("tech.profileEdit.publicProfile")}</Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </View>

      <PrimaryButton
        label={t("tech.profileEdit.save")}
        onPress={() => saveMut.mutate()}
        loading={saveMut.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.sm },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarSkeleton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: mobileColors.surfaceMuted,
    alignSelf: "center",
    marginBottom: mobileSpacing.lg
  },
  photoRow: { alignItems: "center", marginBottom: mobileSpacing.md },
  avatarWrap: { position: "relative" },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2
  },
  avatarPh: {
    backgroundColor: techColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border
  },
  pencilFab: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: techColors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: mobileColors.background
  },
  photoHint: {
    ...mobileTypography.meta,
    color: techColors.primary,
    fontWeight: "600",
    marginTop: mobileSpacing.sm
  },
  section: {
    ...mobileTypography.meta,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: mobileSpacing.md,
    color: mobileColors.textSecondary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    backgroundColor: mobileColors.background
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillActive: {
    backgroundColor: techColors.primaryLight,
    borderWidth: 1,
    borderColor: techColors.primary
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8
  }
});
