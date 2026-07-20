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
  Modal,
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
  ProfileCompletionGauge,
  SectionHeader,
  buyerPalette
} from "../../components/common";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import {
  METEO_LEVELS,
  creditScoreToNumeric,
  getMeteoLevel
} from "../../constants/meteoProfil";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  fetchBuyerDashboard,
  fetchMyCreditScore,
  patchAuthProfile,
  upsertBuyerProfile
} from "../../lib/api";
import {
  buyerProfileCompletionPercent,
  buyerProfileNextEmptyField,
  type BuyerProfileFieldKey
} from "../../lib/buyerProfileCompletion";
import { formatFarmMoney } from "../../lib/formatMoney";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { getSupabase } from "../../lib/supabase";
import { uploadUserAvatarToSupabase } from "../../lib/uploadAvatarToSupabase";
import { getUserFacingError } from "../../lib/userFacingError";
import { welcomeFirstName } from "../../lib/userDisplay";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const AVATAR = 54;

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

type PrefModalKey =
  | "identity"
  | "categories"
  | "priceRange"
  | "radius"
  | "volume"
  | "location"
  | null;

function PrefRow({
  label,
  value,
  empty,
  actionLabel,
  onEdit
}: {
  label: string;
  value: string;
  empty: boolean;
  actionLabel: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.frow}>
      <Text style={styles.frowLabel}>{label}</Text>
      <Text
        style={[styles.frowValue, empty && styles.frowValueEmpty]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
        <Text style={styles.frowEdit}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export function BuyerAccountScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const qc = useQueryClient();
  const [editModal, setEditModal] = useState<PrefModalKey>(null);
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
  const wallet = dashQ.data?.wallet;
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
  }, [profile, editModal]);

  const completion = useMemo(
    () => buyerProfileCompletionPercent(profile),
    [profile]
  );
  const nextField = useMemo(
    () => buyerProfileNextEmptyField(profile),
    [profile]
  );

  const nextFieldHint = useMemo(() => {
    if (!nextField) return null;
    const map: Record<BuyerProfileFieldKey, string> = {
      buyerType: t("buyer.account.nextField.buyerType"),
      businessName: t("buyer.account.nextField.businessName"),
      locationLabel: t("buyer.account.nextField.locationLabel"),
      searchRadiusKm: t("buyer.account.nextField.searchRadiusKm"),
      preferredCategories: t("buyer.account.nextField.preferredCategories"),
      priceRange: t("buyer.account.nextField.priceRange"),
      typicalVolume: t("buyer.account.nextField.typicalVolume"),
      profilePhotoUrl: t("buyer.account.nextField.profilePhotoUrl")
    };
    return map[nextField];
  }, [nextField, t]);

  const buyerTypeLabel = useCallback(
    (bt: string) => {
      if (bt === "individual") return t("buyer.profile.typeIndividual");
      if (
        bt === "professional" ||
        bt === "slaughterhouse" ||
        bt === "wholesaler" ||
        bt === "reseller"
      ) {
        return t(`buyerOnboarding.type.${bt}`, { defaultValue: bt });
      }
      return t("buyerOnboarding.type.other", { defaultValue: bt });
    },
    [t]
  );

  const subtitle = useMemo(() => {
    const typePart = buyerTypeLabel(buyerType);
    const loc = locationLabel.trim();
    return loc ? `${typePart} · ${loc}` : typePart;
  }, [buyerType, locationLabel, buyerTypeLabel]);

  const meteo = useMemo(() => {
    const numeric = creditScoreToNumeric(creditQ.data?.score);
    return getMeteoLevel(creditQ.data ? numeric : null);
  }, [creditQ.data]);

  const meteoLevelIndex = useMemo(
    () => METEO_LEVELS.findIndex((l) => l.id === meteo.id),
    [meteo.id]
  );

  const saveMut = useMutation({
    mutationFn: async (partial: Parameters<typeof upsertBuyerProfile>[2]) => {
      if (!accessToken) throw new Error("no token");
      await upsertBuyerProfile(accessToken, activeProfileId, partial);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
      setEditModal(null);
    },
    onError: (e: Error) =>
      Alert.alert(t("buyer.account.errorTitle"), getUserFacingError(e, t))
  });

  const saveCurrentModal = () => {
    if (editModal === "identity") {
      saveMut.mutate({
        buyerType,
        businessName: businessName.trim() || undefined
      });
      return;
    }
    if (editModal === "categories") {
      saveMut.mutate({ preferredCategories: categories });
      return;
    }
    if (editModal === "priceRange") {
      const min = priceMin.trim() ? Number(priceMin) : undefined;
      const max = priceMax.trim() ? Number(priceMax) : undefined;
      saveMut.mutate({
        priceRangeMin: Number.isFinite(min) ? min : undefined,
        priceRangeMax: Number.isFinite(max) ? max : undefined
      });
      return;
    }
    if (editModal === "radius") {
      const radius = radiusKm.trim() ? Number(radiusKm) : undefined;
      saveMut.mutate({
        searchRadiusKm: Number.isFinite(radius) ? radius : undefined
      });
      return;
    }
    if (editModal === "volume") {
      saveMut.mutate({ typicalVolume: volume || undefined });
      return;
    }
    if (editModal === "location") {
      saveMut.mutate({ locationLabel: locationLabel.trim() || undefined });
    }
  };

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
      const mime = pendingAvatarUri.toLowerCase().includes("png")
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

  const categoriesDisplay = categories.length
    ? categories
        .map((c) => t(`buyerOnboarding.cat.${c}`, { defaultValue: c }))
        .join(", ")
    : t("buyer.account.toComplete");

  const priceDisplay =
    priceMin || priceMax
      ? t("buyer.account.priceRangeValue", {
          min: priceMin || "…",
          max: priceMax || "…"
        })
      : t("buyer.account.toComplete");

  const volumeDisplay = volume || t("buyer.account.toComplete");
  const radiusDisplay = radiusKm
    ? t("buyer.account.radiusValue", { km: radiusKm })
    : t("buyer.account.toComplete");
  const locationDisplay = locationLabel.trim() || t("buyer.account.toComplete");

  const walletDisplay =
    wallet != null
      ? formatFarmMoney(wallet.balance, wallet.currency)
      : "—";

  const openNextField = () => {
    if (!nextField) return;
    if (nextField === "profilePhotoUrl") {
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
      );
      return;
    }
    const map: Partial<Record<BuyerProfileFieldKey, PrefModalKey>> = {
      buyerType: "identity",
      businessName: "identity",
      preferredCategories: "categories",
      priceRange: "priceRange",
      searchRadiusKm: "radius",
      typicalVolume: "volume",
      locationLabel: "location"
    };
    const key = map[nextField];
    if (key) setEditModal(key);
  };

  const modalTitle =
    editModal === "identity"
      ? t("buyer.profile.buyerType")
      : editModal === "categories"
        ? t("buyer.profile.preferredCategories")
        : editModal === "priceRange"
          ? t("buyer.account.priceRange")
          : editModal === "radius"
            ? t("buyer.account.searchRadius")
            : editModal === "volume"
              ? t("buyer.account.typicalVolume")
              : editModal === "location"
                ? t("buyer.account.location")
                : "";

  return (
    <BuyerMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.who}>
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
                  <Ionicons
                    name="cart"
                    size={22}
                    color={buyerColors.primary}
                  />
                </View>
              )}
            </Pressable>
            <View style={styles.hi}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setEditModal("identity")}
            accessibilityRole="button"
            accessibilityLabel={t("buyer.account.edit")}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={buyerColors.textPrimary}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={nextField ? openNextField : undefined}
          disabled={!nextField}
          accessibilityRole={nextField ? "button" : undefined}
          accessibilityLabel={nextFieldHint ?? undefined}
        >
          <ProfileCompletionGauge
            percent={completion}
            palette={buyerPalette}
            label={t("buyer.account.completionLabel")}
            hint={nextFieldHint}
          />
        </Pressable>

        <View style={styles.meteoCard}>
          {creditQ.isLoading ? (
            <ActivityIndicator color={buyerColors.primary} />
          ) : (
            <>
              <View style={styles.meteoLvl}>
                <Text style={styles.meteoSun}>{meteo.icon}</Text>
                <View style={styles.meteoTexts}>
                  <Text style={styles.meteoTitle}>
                    {t(`buyer.account.meteoLevel.${meteo.id}`, {
                      defaultValue: meteo.label
                    })}
                  </Text>
                  <Text style={styles.meteoSub}>
                    {t("buyer.account.meteoLevelOf", {
                      n: meteoLevelIndex + 1,
                      total: METEO_LEVELS.length
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.dots}>
                {METEO_LEVELS.map((lvl, i) => (
                  <View
                    key={lvl.id}
                    style={[
                      styles.dot,
                      i <= meteoLevelIndex && styles.dotOn
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.meteoStats}>
                {t("buyer.account.meteoStats", {
                  total: creditQ.data?.creditTransactionsCount ?? 0,
                  onTime: creditQ.data?.creditOnTimeCount ?? 0
                })}
              </Text>
            </>
          )}
        </View>

        <SectionHeader
          label={t("buyer.account.sectionPrefs")}
          palette={buyerPalette}
        />
        <View style={styles.card}>
          <PrefRow
            label={t("buyer.profile.preferredCategories")}
            value={categoriesDisplay}
            empty={!categories.length}
            actionLabel={
              categories.length
                ? t("buyer.account.edit")
                : t("buyer.account.add")
            }
            onEdit={() => setEditModal("categories")}
          />
          <PrefRow
            label={t("buyer.account.priceRange")}
            value={priceDisplay}
            empty={!priceMin && !priceMax}
            actionLabel={
              priceMin || priceMax
                ? t("buyer.account.edit")
                : t("buyer.account.add")
            }
            onEdit={() => setEditModal("priceRange")}
          />
          <PrefRow
            label={t("buyer.account.searchRadius")}
            value={radiusDisplay}
            empty={!radiusKm}
            actionLabel={
              radiusKm ? t("buyer.account.edit") : t("buyer.account.add")
            }
            onEdit={() => setEditModal("radius")}
          />
          <PrefRow
            label={t("buyer.account.typicalVolume")}
            value={volumeDisplay}
            empty={!volume}
            actionLabel={
              volume ? t("buyer.account.edit") : t("buyer.account.add")
            }
            onEdit={() => setEditModal("volume")}
          />
          <PrefRow
            label={t("buyer.account.location")}
            value={locationDisplay}
            empty={!locationLabel.trim()}
            actionLabel={
              locationLabel.trim()
                ? t("buyer.account.edit")
                : t("buyer.account.add")
            }
            onEdit={() => setEditModal("location")}
          />
        </View>

        <SectionHeader
          label={t("buyer.profile.sectionAccount")}
          palette={buyerPalette}
        />
        <View style={styles.card}>
          <PrefRow
            label={t("buyer.account.walletRow")}
            value={walletDisplay}
            empty={wallet == null}
            actionLabel={t("buyer.account.openShort")}
            onEdit={() => navigation.navigate("UserWallet")}
          />
          <View style={styles.switcherWrap}>
            <ActiveProfileSwitcherControl variant="default" />
          </View>
          <AccountSettingsPanel
            compact
            hideLanguagePicker={false}
            hideActiveProfileSwitcher
          />
        </View>
      </ScrollView>

      <Modal
        visible={editModal != null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {editModal === "identity" ? (
                <>
                  <View style={styles.chips}>
                    {BUYER_TYPES.map((bt) => (
                      <Pressable
                        key={bt}
                        style={[
                          styles.chip,
                          buyerType === bt && styles.chipOn
                        ]}
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
                </>
              ) : null}
              {editModal === "categories" ? (
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
              ) : null}
              {editModal === "priceRange" ? (
                <View style={styles.rowInputs}>
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    keyboardType="numeric"
                    placeholder={t("buyer.account.priceMinPh")}
                    value={priceMin}
                    onChangeText={setPriceMin}
                  />
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    keyboardType="numeric"
                    placeholder={t("buyer.account.priceMaxPh")}
                    value={priceMax}
                    onChangeText={setPriceMax}
                  />
                </View>
              ) : null}
              {editModal === "radius" ? (
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={radiusKm}
                  onChangeText={setRadiusKm}
                  placeholder={t("buyer.account.radiusPh")}
                />
              ) : null}
              {editModal === "volume" ? (
                <View style={styles.chips}>
                  {VOLUMES.map((v) => (
                    <Pressable
                      key={v}
                      style={[styles.chip, volume === v && styles.chipOn]}
                      onPress={() => setVolume(v)}
                    >
                      <Text
                        style={[
                          styles.chipTx,
                          volume === v && styles.chipTxOn
                        ]}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {editModal === "location" ? (
                <TextInput
                  style={styles.input}
                  value={locationLabel}
                  onChangeText={setLocationLabel}
                  placeholder={t("buyer.account.locationPh")}
                />
              ) : null}
            </ScrollView>
            <View style={styles.saveRow}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setEditModal(null)}
              >
                <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={saveCurrentModal}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <ActivityIndicator color={buyerColors.onPrimary} />
                ) : (
                  <Text style={styles.saveTx}>{t("buyer.profile.save")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.sm
  },
  who: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  hi: { flex: 1, gap: 2 },
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
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.1,
    color: buyerColors.textPrimary
  },
  subtitle: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: buyerColors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    ...buyerShadow.card
  },
  meteoCard: {
    backgroundColor: buyerColors.kpiAmber,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    gap: mobileSpacing.sm
  },
  meteoLvl: { flexDirection: "row", alignItems: "center", gap: 10 },
  meteoSun: { fontSize: 34 },
  meteoTexts: { flex: 1, gap: 2 },
  meteoTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: buyerColors.textPrimary
  },
  meteoSub: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  dots: { flexDirection: "row", gap: 5, marginTop: 4 },
  dot: {
    height: 6,
    flex: 1,
    borderRadius: 99,
    backgroundColor: buyerColors.primaryLight
  },
  dotOn: { backgroundColor: buyerColors.warning },
  meteoStats: {
    ...mobileTypography.meta,
    color: buyerColors.textMuted,
    marginTop: 2
  },
  card: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  frow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: buyerColors.border,
    gap: 8
  },
  frowLabel: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    width: "32%"
  },
  frowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: buyerColors.textPrimary,
    textAlign: "right"
  },
  frowValueEmpty: { color: buyerColors.textMuted },
  frowEdit: {
    fontSize: 12,
    fontWeight: "600",
    color: buyerColors.primary,
    marginLeft: 4
  },
  switcherWrap: {
    paddingVertical: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: buyerColors.border
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: buyerColors.modalScrim,
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: buyerColors.cardBg,
    borderTopLeftRadius: buyerRadius.card,
    borderTopRightRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    maxHeight: "75%",
    gap: mobileSpacing.md
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: buyerColors.textPrimary
  },
  modalScroll: { maxHeight: 360 },
  fieldLbl: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    fontWeight: "600",
    marginTop: mobileSpacing.sm,
    marginBottom: 6
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: buyerRadius.pill,
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
    gap: mobileSpacing.sm
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
  saveTx: { color: buyerColors.onPrimary, fontWeight: "700" }
});
