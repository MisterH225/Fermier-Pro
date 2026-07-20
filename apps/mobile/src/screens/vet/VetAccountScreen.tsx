import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import { AccountSettingsPanel } from "../../components/account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../../components/account/ActiveProfileSwitcherControl";
import {
  InfoRow,
  SectionHeader,
  StatCard,
  vetPalette
} from "../../components/common";
import { VetMobileShell } from "../../components/layout";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  fetchVetDashboard,
  fetchVetProfileMe,
  patchVetPublicProfile
} from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { getUserFacingError } from "../../lib/userFacingError";
import { vetColors, vetRadius } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const AVATAR = 96;

export function VetAccountScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const profileQ = useQuery({
    queryKey: ["vetProfileMe", activeProfileId],
    queryFn: () => fetchVetProfileMe(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const dashQ = useQuery({
    queryKey: ["vetDashboard", activeProfileId, "account"],
    queryFn: () => fetchVetDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const vet = profileQ.data;
  const stats = dashQ.data?.stats;

  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!vet) return;
    setBio(vet.bio ?? "");
    setSpecialty(vet.primarySpecialty ?? "");
    setCity(vet.locationLabel?.split(",")[0]?.trim() ?? "");
    setRadiusKm(
      vet.interventionRadiusKm != null ? String(vet.interventionRadiusKm) : ""
    );
    setAvailable(vet.availability);
  }, [vet]);

  const avatarUri = useMemo(() => {
    return (
      resolveActiveProfileAvatarUrl(authMe, activeProfileId) ??
      vet?.profilePhotoUrl ??
      null
    );
  }, [authMe, activeProfileId, vet?.profilePhotoUrl]);

  const displayName = vet?.fullName ?? authMe?.user.fullName ?? "—";

  const saveMut = useMutation({
    mutationFn: () => {
      const radius = radiusKm.trim() ? Number(radiusKm) : undefined;
      return patchVetPublicProfile(
        accessToken!,
        {
          bio: bio.trim(),
          primarySpecialty: specialty.trim() || undefined,
          locationCity: city.trim() || undefined,
          availability: available,
          interventionRadiusKm: Number.isFinite(radius) ? radius : undefined
        },
        activeProfileId
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vetProfileMe"] });
      await qc.invalidateQueries({ queryKey: ["vetDashboard"] });
      setEditing(false);
    },
    onError: (e: Error) =>
      Alert.alert(t("vet.account.errorTitle"), getUserFacingError(e, t))
  });

  const verificationLabel = vet?.isVerified
    ? t("vet.account.verified")
    : t("vet.account.pending");

  return (
    <VetMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
      >
        <View style={styles.hero}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <Ionicons name="medical" size={40} color={vetColors.primary} />
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.badge}>{verificationLabel}</Text>
          <ActiveProfileSwitcherControl variant="hero" />
        </View>

        <SectionHeader
          label={t("vet.account.sectionIdentity")}
          palette={vetPalette}
        />
        <View style={styles.card}>
          <InfoRow
            label={t("vet.account.orderNumber")}
            value={vet?.orderNumber ?? "—"}
            palette={vetPalette}
          />
          <InfoRow
            label={t("vet.account.specialty")}
            value={vet?.primarySpecialty ?? "—"}
            palette={vetPalette}
          />
          <InfoRow
            label={t("vet.account.verification")}
            value={verificationLabel}
            palette={vetPalette}
          />
        </View>

        <SectionHeader
          label={t("vet.account.sectionPublic")}
          palette={vetPalette}
        />
        <View style={styles.card}>
          {!editing ? (
            <>
              <InfoRow
                label={t("vet.account.bio")}
                value={vet?.bio?.trim() || "—"}
                palette={vetPalette}
              />
              <InfoRow
                label={t("vet.account.specialty")}
                value={vet?.primarySpecialty ?? "—"}
                palette={vetPalette}
              />
              <InfoRow
                label={t("vet.account.city")}
                value={vet?.locationLabel ?? "—"}
                palette={vetPalette}
              />
              <InfoRow
                label={t("vet.account.radius")}
                value={
                  vet?.interventionRadiusKm != null
                    ? `${vet.interventionRadiusKm} km`
                    : "—"
                }
                palette={vetPalette}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLbl}>
                  {t("vet.account.availability")}
                </Text>
                <Switch
                  value={vet?.availability ?? false}
                  disabled
                  trackColor={{
                    false: vetColors.border,
                    true: vetColors.primarySoft
                  }}
                />
              </View>
              <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnTx}>{t("vet.account.editPublic")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.fieldLbl}>{t("vet.account.bio")}</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                multiline
                value={bio}
                onChangeText={setBio}
              />
              <Text style={styles.fieldLbl}>{t("vet.account.specialty")}</Text>
              <TextInput
                style={styles.input}
                value={specialty}
                onChangeText={setSpecialty}
              />
              <Text style={styles.fieldLbl}>{t("vet.account.city")}</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
              />
              <Text style={styles.fieldLbl}>{t("vet.account.radius")}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={radiusKm}
                onChangeText={setRadiusKm}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLbl}>
                  {t("vet.account.availability")}
                </Text>
                <Switch
                  value={available}
                  onValueChange={setAvailable}
                  trackColor={{
                    false: vetColors.border,
                    true: vetColors.primarySoft
                  }}
                  thumbColor={available ? vetColors.primary : undefined}
                />
              </View>
              <View style={styles.saveRow}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setEditing(false)}
                >
                  <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={styles.saveBtn}
                  onPress={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                >
                  {saveMut.isPending ? (
                    <ActivityIndicator color={vetColors.onPrimary} />
                  ) : (
                    <Text style={styles.saveTx}>{t("common.save")}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        <SectionHeader
          label={t("vet.account.sectionReputation")}
          palette={vetPalette}
        />
        <View style={styles.statsRow}>
          <StatCard
            label={t("vet.account.rating")}
            value={
              stats?.averageRating != null
                ? stats.averageRating.toFixed(1)
                : "—"
            }
            palette={vetPalette}
          />
          <StatCard
            label={t("vet.account.reviews")}
            value={vet?.ratingCount ?? 0}
            palette={vetPalette}
          />
          <StatCard
            label={t("vet.account.visitsDone")}
            value={stats?.visitsCompleted ?? 0}
            palette={vetPalette}
          />
        </View>

        <SectionHeader
          label={t("vet.account.sectionIncome")}
          palette={vetPalette}
        />
        <Pressable
          style={styles.linkCard}
          onPress={() => navigation.navigate("UserWallet")}
        >
          <Ionicons name="wallet-outline" size={22} color={vetColors.primary} />
          <Text style={styles.linkTx}>{t("vet.account.openWallet")}</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={vetColors.textMuted}
          />
        </Pressable>

        <SectionHeader
          label={t("vet.account.sectionDiploma")}
          palette={vetPalette}
        />
        <View style={styles.card}>
          <InfoRow
            label={t("vet.account.school")}
            value={
              vet
                ? `${vet.schoolName} (${vet.schoolCountry}) · ${vet.graduationYear}`
                : "—"
            }
            palette={vetPalette}
          />
          <Text style={styles.readonlyHint}>
            {t("vet.account.diplomaReadonly")}
          </Text>
        </View>

        <SectionHeader
          label={t("vet.account.sectionSettings")}
          palette={vetPalette}
        />
        <AccountSettingsPanel compact hideActiveProfileSwitcher />
      </ScrollView>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  hero: { alignItems: "center", paddingBottom: mobileSpacing.md },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2
  },
  avatarPh: {
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  name: {
    marginTop: mobileSpacing.md,
    fontSize: 24,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  badge: {
    marginTop: 4,
    ...mobileTypography.meta,
    color: vetColors.primary,
    fontWeight: "700"
  },
  card: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: mobileSpacing.md
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  switchLbl: { color: vetColors.textPrimary, fontWeight: "500" },
  editBtn: { alignSelf: "flex-start", paddingVertical: mobileSpacing.sm },
  editBtnTx: { color: vetColors.primary, fontWeight: "700" },
  fieldLbl: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    fontWeight: "600"
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    borderRadius: vetRadius.button,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    color: vetColors.textPrimary,
    backgroundColor: vetColors.canvas
  },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  saveRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.sm
  },
  cancelBtn: { padding: mobileSpacing.sm },
  cancelTx: { color: vetColors.textSecondary, fontWeight: "600" },
  saveBtn: {
    backgroundColor: vetColors.primary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderRadius: vetRadius.button,
    minWidth: 100,
    alignItems: "center"
  },
  saveTx: { color: vetColors.onPrimary, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: mobileSpacing.sm },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  linkTx: { flex: 1, fontWeight: "600", color: vetColors.textPrimary },
  readonlyHint: {
    ...mobileTypography.meta,
    color: vetColors.textMuted
  }
});
