import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
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
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountSettingsPanel } from "../account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../account/ActiveProfileSwitcherControl";
import { ProfileLanguagePill } from "../account/ProfileLanguagePill";
import { useSession } from "../../context/SessionContext";
import {
  fetchMerchantDashboard,
  fetchMerchantMe,
  patchAuthProfile,
  renewMerchantSubscription
} from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { getSupabase } from "../../lib/supabase";
import { uploadUserAvatarToSupabase } from "../../lib/uploadAvatarToSupabase";
import { welcomeFirstName } from "../../lib/userDisplay";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const AVATAR = 108;
const PENCIL = 36;

type MerchantProfileModalProps = {
  visible: boolean;
  onClose: () => void;
};

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={styles.sectionHeader} accessibilityRole="header">
      {label}
    </Text>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function MerchantProfileModal({ visible, onClose }: MerchantProfileModalProps) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId, "profileModal"],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(visible && accessToken && activeProfileId)
  });

  const dashQ = useQuery({
    queryKey: ["merchant-dashboard", activeProfileId, "profileModal"],
    queryFn: () => fetchMerchantDashboard(accessToken!, activeProfileId!),
    enabled: Boolean(visible && accessToken && activeProfileId)
  });

  const resetAvatar = useCallback(() => {
    setPendingAvatarUri(null);
  }, []);

  useEffect(() => {
    if (visible) {
      resetAvatar();
    }
  }, [visible, resetAvatar]);

  const displayAvatarUri =
    pendingAvatarUri ?? resolveActiveProfileAvatarUrl(authMe, activeProfileId);

  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("merchant.dashboard.defaultName");

  const me = meQ.data;
  const dash = dashQ.data;

  const tierLabel =
    me?.subscriptionStatus === "past_due"
      ? t("merchant.subscription.statusPastDue")
      : me?.subscriptionTier === "premium"
        ? t("merchant.subscription.premiumTitle")
        : me?.subscriptionTier === "free"
          ? t("merchant.subscription.freeTitle")
          : t("merchant.dashboard.tierNone");

  const nextBillingLabel = me?.nextBillingAt
    ? new Date(me.nextBillingAt).toLocaleDateString("fr-FR")
    : "—";

  const shopsLabel =
    me != null
      ? `${me.shopCount} / ${me.maxShops}`
      : "—";

  const productsLabel =
    me != null
      ? me.maxActiveProducts != null
        ? `${me.activeProductCount} / ${me.maxActiveProducts}`
        : String(me.activeProductCount)
      : "—";

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
      setPendingAvatarUri(result.assets[0].uri);
    }
  };

  const openPhotoMenu = () => {
    Alert.alert(
      t("merchant.profile.changePhotoTitle"),
      t("merchant.profile.changePhotoMessage"),
      [
        {
          text: t("merchant.profile.pickGallery"),
          onPress: () => void pickImage("library")
        },
        {
          text: t("merchant.profile.pickCamera"),
          onPress: () => void pickImage("camera")
        },
        { text: t("merchant.profile.cancelPhoto"), style: "cancel" }
      ]
    );
  };

  const onSave = async () => {
    if (!pendingAvatarUri) {
      onClose();
      return;
    }
    if (!accessToken) {
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabase();
      if (!supabase || !authMe?.user.supabaseUserId) {
        Alert.alert("", t("merchant.profile.photoUploadError"));
        setSaving(false);
        return;
      }
      const mime =
        pendingAvatarUri.toLowerCase().endsWith(".png") ||
        pendingAvatarUri.includes("png")
          ? "image/png"
          : "image/jpeg";
      const avatarUrl = await uploadUserAvatarToSupabase(
        supabase,
        authMe.user.supabaseUserId,
        pendingAvatarUri,
        mime,
        "merchant"
      );
      await patchAuthProfile(accessToken, { avatarUrl }, activeProfileId);
      await refreshAuthMe();
      onClose();
    } catch (e) {
      Alert.alert(
        "",
        e instanceof Error ? e.message : t("merchant.profile.saveError")
      );
    } finally {
      setSaving(false);
    }
  };

  const openRenewPayment = async () => {
    if (!accessToken || !activeProfileId) return;
    const url =
      me?.pendingRenewal?.paymentUrl ??
      (await renewMerchantSubscription(accessToken, activeProfileId)).paymentUrl;
    if (url) {
      await Linking.openURL(url);
    }
    void meQ.refetch();
  };

  const openSubscription = () => {
    onClose();
    navigation.navigate("MerchantSubscription");
  };

  const showSave = Boolean(pendingAvatarUri);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <ProfileLanguagePill
            alignMenuWithCloseRow
            edgePadding={mobileSpacing.lg}
          />
          <View style={styles.topBarActions}>
            {showSave ? (
              <Pressable
                onPress={() => void onSave()}
                disabled={saving}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t("merchant.profile.save")}
                style={styles.saveHit}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={merchantColors.primary} />
                ) : (
                  <Text style={styles.saveText}>{t("merchant.profile.save")}</Text>
                )}
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={t("producer.close")}
              style={styles.closeHit}
            >
              <Text style={styles.closeText}>{t("producer.close")}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.avatarRing}>
              {displayAvatarUri ? (
                <Image source={{ uri: displayAvatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]}>
                  <Ionicons name="storefront" size={44} color={merchantColors.primary} />
                </View>
              )}
              <Pressable
                style={styles.pencilFab}
                onPress={openPhotoMenu}
                accessibilityRole="button"
                accessibilityLabel={t("merchant.profile.changePhotoTitle")}
              >
                <Ionicons name="pencil" size={18} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.heroName} numberOfLines={2}>
              {displayName}
            </Text>
            {authMe?.user.email ? (
              <Text style={styles.heroEmail} numberOfLines={1}>
                {authMe.user.email}
              </Text>
            ) : null}
            <ActiveProfileSwitcherControl variant="hero" />
          </View>

          {me?.subscriptionTier !== "premium" ? (
            <Pressable style={styles.upgradeBtn} onPress={openSubscription}>
              <Text style={styles.upgradeBtnTx}>{t("merchant.dashboard.upgradeCta")}</Text>
            </Pressable>
          ) : null}

          {me?.subscriptionStatus === "past_due" ? (
            <Pressable style={styles.renewBtn} onPress={() => void openRenewPayment()}>
              <Text style={styles.renewBtnTx}>{t("merchant.subscription.renewCta")}</Text>
            </Pressable>
          ) : null}

          <SectionHeader label={t("merchant.profile.sectionMerchant")} />
          <View style={styles.proCard}>
            <InfoBlock label={t("merchant.profile.subscription")} value={tierLabel} />
            {me?.subscriptionTier === "premium" ? (
              <InfoBlock
                label={t("merchant.profile.nextBilling")}
                value={nextBillingLabel}
              />
            ) : null}
            {me?.graceEndsAt ? (
              <InfoBlock
                label={t("merchant.profile.graceEnds")}
                value={new Date(me.graceEndsAt).toLocaleDateString("fr-FR")}
              />
            ) : null}
            <InfoBlock label={t("merchant.profile.shops")} value={shopsLabel} />
            <InfoBlock label={t("merchant.profile.activeProducts")} value={productsLabel} />
            {me?.shops[0]?.name ? (
              <InfoBlock
                label={t("merchant.profile.mainShop")}
                value={me.shops[0].name}
              />
            ) : null}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {(dash?.kpis.monthRevenueXof ?? 0).toLocaleString("fr-FR")}
                </Text>
                <Text style={styles.statLbl}>{t("merchant.kpi.revenue")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{dash?.kpis.pendingOrders ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("merchant.kpi.pendingOrders")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{dash?.kpis.productViews ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("merchant.kpi.views")}</Text>
              </View>
            </View>
          </View>

          <SectionHeader label={t("merchant.profile.sectionAccount")} />
          <AccountSettingsPanel
            onBeforeNavigate={onClose}
            compact
            hideLanguagePicker
            hideActiveProfileSwitcher
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: merchantColors.canvas
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  saveHit: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 36
  },
  saveText: {
    ...mobileTypography.body,
    color: merchantColors.primary,
    fontWeight: "600",
    fontSize: 17
  },
  closeHit: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 36
  },
  closeText: {
    ...mobileTypography.body,
    color: merchantColors.primary,
    fontWeight: "600",
    fontSize: 17
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.sm
  },
  hero: {
    alignItems: "center",
    paddingTop: mobileSpacing.md,
    paddingBottom: mobileSpacing.lg
  },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    position: "relative"
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2
  },
  avatarPh: {
    backgroundColor: merchantColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: merchantColors.border
  },
  pencilFab: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: PENCIL,
    height: PENCIL,
    borderRadius: PENCIL / 2,
    backgroundColor: merchantColors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: merchantColors.canvas,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4
  },
  heroName: {
    marginTop: mobileSpacing.lg,
    fontSize: 26,
    fontWeight: "700",
    color: merchantColors.textPrimary,
    textAlign: "center",
    maxWidth: "100%"
  },
  heroEmail: {
    marginTop: 4,
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    textAlign: "center",
    maxWidth: "100%"
  },
  upgradeBtn: {
    backgroundColor: merchantColors.primary,
    borderRadius: merchantRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  upgradeBtnTx: {
    color: merchantColors.onPrimary,
    fontWeight: "700",
    fontSize: 16
  },
  renewBtn: {
    backgroundColor: merchantColors.warning,
    borderRadius: merchantRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  renewBtnTx: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  sectionHeader: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: merchantColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xs
  },
  proCard: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: merchantColors.border,
    gap: mobileSpacing.md
  },
  infoBlock: { gap: 2 },
  label: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary
  },
  value: {
    color: merchantColors.textPrimary,
    fontWeight: "500",
    fontSize: 15
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: merchantColors.primaryLight,
    borderRadius: merchantRadius.button,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.xs
  },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 20, fontWeight: "800", color: merchantColors.primary },
  statLbl: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    textAlign: "center",
    marginTop: 2
  }
});
