import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountSettingsPanel } from "../account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../account/ActiveProfileSwitcherControl";
import { ProfileLanguagePill } from "../account/ProfileLanguagePill";
import { useSession } from "../../context/SessionContext";
import { fetchBuyerDashboard, patchAuthProfile } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { getSupabase } from "../../lib/supabase";
import { uploadUserAvatarToSupabase } from "../../lib/uploadAvatarToSupabase";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";

const AVATAR = 108;
const PENCIL = 36;

type BuyerProfileModalProps = {
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

export function BuyerProfileModal({ visible, onClose }: BuyerProfileModalProps) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dashQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId, "profileModal"],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const profile = dashQ.data?.profile;
  const kpis = dashQ.data?.kpis;

  const resetAvatar = useCallback(() => {
    setPendingAvatarUri(null);
  }, []);

  useEffect(() => {
    if (visible) {
      resetAvatar();
    }
  }, [visible, resetAvatar]);

  const displayAvatarUri =
    pendingAvatarUri ??
    resolveActiveProfileAvatarUrl(authMe, activeProfileId);

  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("buyer.dashboard.defaultName");

  const buyerTypeLabel =
    profile?.buyerType === "individual"
      ? t("buyer.profile.typeIndividual")
      : profile?.buyerType === "professional"
        ? t("buyer.profile.typeProfessional")
        : profile?.buyerType ?? "—";

  const categoriesLabel =
    profile?.preferredCategories?.length
      ? profile.preferredCategories.join(", ")
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
        Alert.alert("", t("buyer.profile.photoUploadError"));
        setSaving(false);
        return;
      }
      const mime =
        pendingAvatarUri.toLowerCase().endsWith(".png") ||
        pendingAvatarUri.includes("png")
          ? "image/png"
          : "image/jpeg";
      const profileType =
        authMe?.profiles.find((p) => p.id === activeProfileId)?.type ??
        authMe?.activeProfile?.type ??
        "buyer";
      const avatarUrl = await uploadUserAvatarToSupabase(
        supabase,
        authMe.user.supabaseUserId,
        pendingAvatarUri,
        mime,
        profileType
      );
      await patchAuthProfile(accessToken, { avatarUrl }, activeProfileId);
      await refreshAuthMe();
      onClose();
    } catch (e) {
      Alert.alert(
        "",
        e instanceof Error ? e.message : t("buyer.profile.saveError")
      );
    } finally {
      setSaving(false);
    }
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
                accessibilityLabel={t("buyer.profile.save")}
                style={styles.saveHit}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={buyerColors.primary} />
                ) : (
                  <Text style={styles.saveText}>{t("buyer.profile.save")}</Text>
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
                  <Ionicons name="cart" size={44} color={buyerColors.primary} />
                </View>
              )}
              <Pressable
                style={styles.pencilFab}
                onPress={openPhotoMenu}
                accessibilityRole="button"
                accessibilityLabel={t("buyer.profile.changePhotoTitle")}
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

          <SectionHeader label={t("buyer.profile.sectionBuyer")} />
          <View style={styles.proCard}>
            <InfoBlock label={t("buyer.profile.buyerType")} value={buyerTypeLabel} />
            <InfoBlock
              label={t("buyer.profile.preferredCategories")}
              value={categoriesLabel}
            />
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{kpis?.pendingProposals ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("buyer.kpi.pending")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{kpis?.purchasesCount ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("buyer.kpi.purchases")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{kpis?.favoritesCount ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("buyer.kpi.favorites")}</Text>
              </View>
            </View>
          </View>

          <SectionHeader label={t("buyer.profile.sectionAccount")} />
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
    backgroundColor: buyerColors.canvas
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
    color: buyerColors.primary,
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
    color: buyerColors.primary,
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
    backgroundColor: buyerColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  pencilFab: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: PENCIL,
    height: PENCIL,
    borderRadius: PENCIL / 2,
    backgroundColor: buyerColors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: buyerColors.canvas,
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
    color: buyerColors.textPrimary,
    textAlign: "center",
    maxWidth: "100%"
  },
  heroEmail: {
    marginTop: 4,
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    textAlign: "center",
    maxWidth: "100%"
  },
  sectionHeader: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xs
  },
  proCard: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    gap: mobileSpacing.md
  },
  infoBlock: { gap: 2 },
  label: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  value: {
    color: buyerColors.textPrimary,
    fontWeight: "500",
    fontSize: 15
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: buyerColors.primaryLight,
    borderRadius: buyerRadius.button,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.xs
  },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 20, fontWeight: "800", color: buyerColors.primary },
  statLbl: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    textAlign: "center",
    marginTop: 2
  }
});
