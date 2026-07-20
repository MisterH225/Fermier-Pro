import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AccountSettingsPanel } from "../../components/account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../../components/account/ActiveProfileSwitcherControl";
import {
  InfoRow,
  ProfileCompletionGauge,
  SectionHeader,
  buyerPalette
} from "../../components/common";
import { CreditScoreBadge } from "../../components/marketplace/CreditScoreBadge";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  fetchBuyerDashboard,
  fetchMyCreditScore,
  patchAuthProfile,
  upsertBuyerProfile
} from "../../lib/api";
import { buyerProfileCompletionPercent } from "../../lib/buyerProfileCompletion";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { getSupabase } from "../../lib/supabase";
import { uploadUserAvatarToSupabase } from "../../lib/uploadAvatarToSupabase";
import { getUserFacingError } from "../../lib/userFacingError";
import { welcomeFirstName } from "../../lib/userDisplay";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const AVATAR = 96;
const BUYER_TYPES = [
  "individual",
  "slaughterhouse",
  "wholesaler",
  "reseller",
  "other"
] as const;
const CATEGORIES = [
  "piglet",
  "breeder_male",
  "breeder_female",
  "butcher",
  "reformed"
] as const;
const VOLUMES = ["1-5", "5-20", "20-50", "50+"] as const;

const SCORE_LEVELS = [
  "excellent",
  "bon",
  "nouveau",
  "attention",
  "risque"
] as const;

export function BuyerAccountScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const qc = useQueryClient();
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);

  const dashQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId, "account"],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const creditQ = useQuery({
    queryKey: ["buyerCreditScore", activeProfileId],
    queryFn: () => fetchMyCreditScore(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const profile = dashQ.data?.profile;
  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("buyer.dashboard.defaultName");
  const avatarUri =
    pendingAvatarUri ??
    resolveActiveProfileAvatarUrl(authMe, activeProfileId) ??
    profile?.profilePhotoUrl ??
    null;

  const [buyerType, setBuyerType] = useState("individual");
  const [businessName, setBusinessName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [volume, setVolume] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [locationLabel, setLocationLabel] = useState("");

  useEffect(() => {
    if (!profile) return;
    setBuyerType(profile.buyerType || "individual");
    setBusinessName(profile.businessName ?? "");
    setCategories(profile.preferredCategories ?? []);
    setPriceMin(profile.priceRangeMin ?? "");
    setPriceMax(profile.priceRangeMax ?? "");
    setVolume(profile.typicalVolume ?? "");
    setRadiusKm(
      profile.searchRadiusKm != null ? String(profile.searchRadiusKm) : ""
    );
    setLocationLabel(profile.locationLabel ?? "");
  }, [profile]);

  const completion = useMemo(
    () => buyerProfileCompletionPercent(profile),
    [profile]
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("no token");
      const min = priceMin.trim() ? Number(priceMin) : undefined;
      const max = priceMax.trim() ? Number(priceMax) : undefined;
      const radius = radiusKm.trim() ? Number(radiusKm) : undefined;
      await upsertBuyerProfile(accessToken, activeProfileId, {
        buyerType,
        businessName: businessName.trim() || undefined,
        preferredCategories: categories,
        priceRangeMin: Number.isFinite(min) ? min : undefined,
        priceRangeMax: Number.isFinite(max) ? max : undefined,
        typicalVolume: volume || undefined,
        searchRadiusKm: Number.isFinite(radius) ? radius : undefined,
        locationLabel: locationLabel.trim() || undefined
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
      setEditingPrefs(false);
    },
    onError: (e: Error) =>
      Alert.alert(t("buyer.account.errorTitle"), getUserFacingError(e, t))
  });

  const pickImage = async (source: "library" | "camera") => {
    const perm =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
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
      setPendingAvatarUri(result.assets[0].uri);
    }
  };

  const saveAvatar = useCallback(async () => {
    if (!pendingAvatarUri || !accessToken) return;
    try {
      const supabase = getSupabase();
      if (!supabase || !authMe?.user.supabaseUserId) {
        Alert.alert("", t("buyer.profile.photoUploadError"));
        return;
      }
      const mime =
        pendingAvatarUri.toLowerCase().includes("png")
          ? "image/png"
          : "image/jpeg";
      const avatarUrl = await uploadUserAvatarToSupabase(
        supabase,
        authMe.user.supabaseUserId,
        pendingAvatarUri,
        mime,
        "buyer"
      );
      await patchAuthProfile(accessToken, { avatarUrl }, activeProfileId);
      await upsertBuyerProfile(accessToken, activeProfileId, {
        profilePhotoUrl: avatarUrl
      });
      await refreshAuthMe();
      await qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
      setPendingAvatarUri(null);
    } catch (e) {
      Alert.alert(
        "",
        e instanceof Error ? e.message : t("buyer.profile.saveError")
      );
    }
  }, [
    pendingAvatarUri,
    accessToken,
    authMe,
    activeProfileId,
    refreshAuthMe,
    qc,
    t
  ]);

  useEffect(() => {
    if (pendingAvatarUri) void saveAvatar();
  }, [pendingAvatarUri, saveAvatar]);

  const toggleCategory = (c: string) => {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const buyerTypeLabel = (bt: string) => {
    if (bt === "individual") return t("buyer.profile.typeIndividual");
    if (bt === "professional" || bt === "slaughterhouse" || bt === "wholesaler" || bt === "reseller") {
      return t(`buyerOnboarding.type.${bt}`, { defaultValue: bt });
    }
    return t("buyerOnboarding.type.other", { defaultValue: bt });
  };

  return (
    <BuyerMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Pressable
            onPress={() =>
              Alert.alert(
                t("buyer.profile.changePhotoTitle"),
                t("buyer.profile.changePhotoMessage"),
                [
                  {
                    text: t("buyer.profile.pickGallery"),
                    onPress: () => void pickImage("library")
                  },
                  {
                    text: t("buyer.profile.pickCamera"),
                    onPress: () => void pickImage("camera")
                  },
                  { text: t("buyer.profile.cancelPhoto"), style: "cancel" }
                ]
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t("buyer.profile.changePhotoTitle")}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Ionicons name="cart" size={40} color={buyerColors.primary} />
              </View>
            )}
          </Pressable>
          <Text style={styles.name}>{displayName}</Text>
          {authMe?.user.email ? (
            <Text style={styles.email}>{authMe.user.email}</Text>
          ) : null}
          <ActiveProfileSwitcherControl variant="hero" />
        </View>

        <ProfileCompletionGauge
          percent={completion}
          palette={buyerPalette}
          label={t("buyer.account.completionLabel")}
          ctaLabel={t("buyer.account.completeCta")}
          onPressCta={() => setEditingPrefs(true)}
        />

        <SectionHeader
          label={t("buyer.account.sectionIdentity")}
          palette={buyerPalette}
        />
        <View style={styles.card}>
          <InfoRow
            label={t("buyer.profile.buyerType")}
            value={buyerTypeLabel(buyerType)}
            palette={buyerPalette}
          />
          {buyerType !== "individual" ? (
            <InfoRow
              label={t("buyer.account.businessName")}
              value={businessName.trim() || "—"}
              palette={buyerPalette}
            />
          ) : null}
        </View>

        <SectionHeader
          label={t("buyer.account.sectionMeteo")}
          palette={buyerPalette}
        />
        <View style={styles.card}>
          <Text style={styles.meteoHint}>{t("buyer.account.meteoHint")}</Text>
          {creditQ.isLoading ? (
            <ActivityIndicator color={buyerColors.primary} />
          ) : (
            <>
              <CreditScoreBadge score={creditQ.data} />
              <View style={styles.levels}>
                {SCORE_LEVELS.map((lvl) => (
                  <Text
                    key={lvl}
                    style={[
                      styles.levelChip,
                      creditQ.data?.score === lvl && styles.levelChipOn
                    ]}
                  >
                    {t(`buyer.account.scoreLevel.${lvl}`)}
                  </Text>
                ))}
              </View>
              {creditQ.data ? (
                <Text style={styles.punctuality}>
                  {t("buyer.account.punctuality", {
                    onTime: creditQ.data.creditOnTimeCount,
                    late: creditQ.data.creditLateCount,
                    total: creditQ.data.creditTransactionsCount
                  })}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <SectionHeader
          label={t("buyer.account.sectionPrefs")}
          palette={buyerPalette}
        />
        <View style={styles.card}>
          {!editingPrefs ? (
            <>
              <InfoRow
                label={t("buyer.profile.preferredCategories")}
                value={
                  categories.length
                    ? categories
                        .map((c) =>
                          t(`buyerOnboarding.cat.${c}`, { defaultValue: c })
                        )
                        .join(", ")
                    : "—"
                }
                palette={buyerPalette}
              />
              <InfoRow
                label={t("buyer.account.priceRange")}
                value={
                  priceMin || priceMax
                    ? `${priceMin || "…"} – ${priceMax || "…"} FCFA/kg`
                    : "—"
                }
                palette={buyerPalette}
              />
              <InfoRow
                label={t("buyer.account.typicalVolume")}
                value={volume || "—"}
                palette={buyerPalette}
              />
              <InfoRow
                label={t("buyer.account.searchRadius")}
                value={radiusKm ? `${radiusKm} km` : "—"}
                palette={buyerPalette}
              />
              <InfoRow
                label={t("buyer.account.location")}
                value={locationLabel || "—"}
                palette={buyerPalette}
              />
              <Pressable
                style={styles.editBtn}
                onPress={() => setEditingPrefs(true)}
              >
                <Text style={styles.editBtnTx}>{t("buyer.account.editPrefs")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.fieldLbl}>{t("buyer.profile.buyerType")}</Text>
              <View style={styles.chips}>
                {BUYER_TYPES.map((bt) => (
                  <Pressable
                    key={bt}
                    style={[styles.chip, buyerType === bt && styles.chipOn]}
                    onPress={() => setBuyerType(bt)}
                  >
                    <Text
                      style={[
                        styles.chipTx,
                        buyerType === bt && styles.chipTxOn
                      ]}
                    >
                      {buyerTypeLabel(bt)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {buyerType !== "individual" ? (
                <>
                  <Text style={styles.fieldLbl}>
                    {t("buyer.account.businessName")}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={businessName}
                    onChangeText={setBusinessName}
                  />
                </>
              ) : null}
              <Text style={styles.fieldLbl}>
                {t("buyer.profile.preferredCategories")}
              </Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.chip,
                      categories.includes(c) && styles.chipOn
                    ]}
                    onPress={() => toggleCategory(c)}
                  >
                    <Text
                      style={[
                        styles.chipTx,
                        categories.includes(c) && styles.chipTxOn
                      ]}
                    >
                      {t(`buyerOnboarding.cat.${c}`, { defaultValue: c })}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLbl}>{t("buyer.account.priceRange")}</Text>
              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  keyboardType="numeric"
                  placeholder="Min"
                  value={priceMin}
                  onChangeText={setPriceMin}
                />
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  keyboardType="numeric"
                  placeholder="Max"
                  value={priceMax}
                  onChangeText={setPriceMax}
                />
              </View>
              <Text style={styles.fieldLbl}>
                {t("buyer.account.typicalVolume")}
              </Text>
              <View style={styles.chips}>
                {VOLUMES.map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.chip, volume === v && styles.chipOn]}
                    onPress={() => setVolume(v)}
                  >
                    <Text
                      style={[styles.chipTx, volume === v && styles.chipTxOn]}
                    >
                      {v}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLbl}>
                {t("buyer.account.searchRadius")}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={radiusKm}
                onChangeText={setRadiusKm}
                placeholder="km"
              />
              <Text style={styles.fieldLbl}>{t("buyer.account.location")}</Text>
              <TextInput
                style={styles.input}
                value={locationLabel}
                onChangeText={setLocationLabel}
              />
              <View style={styles.saveRow}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setEditingPrefs(false)}
                >
                  <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={styles.saveBtn}
                  onPress={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                >
                  {saveMut.isPending ? (
                    <ActivityIndicator color={buyerColors.onPrimary} />
                  ) : (
                    <Text style={styles.saveTx}>{t("buyer.profile.save")}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        <SectionHeader
          label={t("buyer.account.sectionWallet")}
          palette={buyerPalette}
        />
        <Pressable
          style={styles.linkCard}
          onPress={() => navigation.navigate("UserWallet")}
        >
          <Ionicons name="wallet-outline" size={22} color={buyerColors.primary} />
          <Text style={styles.linkTx}>{t("buyer.account.openWallet")}</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={buyerColors.textMuted}
          />
        </Pressable>

        <SectionHeader
          label={t("buyer.profile.sectionAccount")}
          palette={buyerPalette}
        />
        <AccountSettingsPanel
          compact
          hideLanguagePicker={false}
          hideActiveProfileSwitcher
        />
      </ScrollView>
    </BuyerMobileShell>
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
    backgroundColor: buyerColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  name: {
    marginTop: mobileSpacing.md,
    fontSize: 24,
    fontWeight: "700",
    color: buyerColors.textPrimary
  },
  email: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: 2
  },
  card: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    gap: mobileSpacing.md
  },
  meteoHint: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  levelChip: {
    ...mobileTypography.meta,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: buyerColors.primaryLight,
    color: buyerColors.textSecondary
  },
  levelChipOn: {
    backgroundColor: buyerColors.primary,
    color: buyerColors.onPrimary,
    fontWeight: "700"
  },
  punctuality: {
    ...mobileTypography.meta,
    color: buyerColors.textPrimary
  },
  editBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.sm
  },
  editBtnTx: { color: buyerColors.primary, fontWeight: "700" },
  fieldLbl: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    fontWeight: "600"
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: buyerColors.primaryLight
  },
  chipOn: { backgroundColor: buyerColors.primary },
  chipTx: { ...mobileTypography.meta, color: buyerColors.textSecondary },
  chipTxOn: { color: buyerColors.onPrimary, fontWeight: "700" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    borderRadius: buyerRadius.button,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    color: buyerColors.textPrimary,
    backgroundColor: buyerColors.canvas
  },
  rowInputs: { flexDirection: "row", gap: mobileSpacing.sm },
  inputHalf: { flex: 1 },
  saveRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  cancelBtn: { padding: mobileSpacing.sm },
  cancelTx: { color: buyerColors.textSecondary, fontWeight: "600" },
  saveBtn: {
    backgroundColor: buyerColors.primary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderRadius: buyerRadius.button,
    minWidth: 100,
    alignItems: "center"
  },
  saveTx: { color: buyerColors.onPrimary, fontWeight: "700" },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  linkTx: {
    flex: 1,
    fontWeight: "600",
    color: buyerColors.textPrimary
  }
});
