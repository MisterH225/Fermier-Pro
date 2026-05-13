import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import { patchAuthProfile, type PatchMeProfilePayload } from "../../lib/api";
import { isDemoBypassToken } from "../../lib/demoBypass";
import { getSupabase } from "../../lib/supabase";
import { uploadUserAvatarToSupabase } from "../../lib/uploadAvatarToSupabase";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { AccountSettingsPanel } from "../account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../account/ActiveProfileSwitcherControl";
import { CollaborativeAccessPanel } from "../account/CollaborativeAccessPanel";
import { ProfileLanguagePill } from "../account/ProfileLanguagePill";
import { FarmMapPickerModal } from "./FarmMapPickerModal";

const AVATAR = 108;
const PENCIL = 36;

type ProducerProfileModalProps = {
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

function GroupShell({ children }: { children: ReactNode }) {
  return <View style={styles.groupShell}>{children}</View>;
}

function GroupRow({
  children,
  showDivider
}: {
  children: ReactNode;
  showDivider: boolean;
}) {
  return (
    <View style={[styles.groupRow, showDivider && styles.groupRowDivider]}>
      {children}
    </View>
  );
}

export function ProducerProfileModal({
  visible,
  onClose
}: ProducerProfileModalProps) {
  const { t } = useTranslation();
  const {
    accessToken,
    activeProfileId,
    authMe,
    refreshAuthMe
  } = useSession();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [locLabel, setLocLabel] = useState("");
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [locSource, setLocSource] = useState<"gps" | "manual" | null>(null);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  const resetFromAuth = useCallback(() => {
    const u = authMe?.user;
    if (!u) {
      return;
    }
    setFirstName(u.firstName ?? "");
    setLastName(u.lastName ?? "");
    setFarmName(u.producerHomeFarmName ?? "");
    setLocLabel(u.homeLocationLabel ?? "");
    setLocLat(u.homeLatitude);
    setLocLng(u.homeLongitude);
    setLocSource(
      u.homeLocationSource === "gps" || u.homeLocationSource === "manual"
        ? u.homeLocationSource
        : null
    );
    setPendingAvatarUri(null);
  }, [authMe]);

  useEffect(() => {
    if (visible) {
      resetFromAuth();
    } else {
      setMapPickerVisible(false);
    }
  }, [visible, resetFromAuth]);

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
      t("producer.changePhotoTitle"),
      t("producer.changePhotoMessage"),
      [
        {
          text: t("producer.pickGallery"),
          onPress: () => void pickImage("library")
        },
        {
          text: t("producer.pickCamera"),
          onPress: () => void pickImage("camera")
        },
        { text: t("producer.cancelPhoto"), style: "cancel" }
      ]
    );
  };

  const fillGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("", t("producer.gpsDenied"));
      return;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setLocLat(lat);
    setLocLng(lng);
    setLocSource("gps");
    setLocLabel((prev) =>
      prev.trim() ? prev : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    );
    Alert.alert("", t("producer.gpsSuccess"));
  };

  const onSave = async () => {
    if (isDemoBypassToken(accessToken)) {
      Alert.alert("", t("producer.demoNoSave"));
      return;
    }
    setSaving(true);
    try {
      const body: PatchMeProfilePayload = {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        producerHomeFarmName: farmName.trim() || null,
        homeLocationLabel: locLabel.trim() || null,
        homeLatitude: locLat,
        homeLongitude: locLng,
        homeLocationSource: locSource
      };

      if (pendingAvatarUri) {
        const supabase = getSupabase();
        if (!supabase || !authMe?.user.id) {
          Alert.alert("", t("producer.photoUploadError"));
          setSaving(false);
          return;
        }
        const mime =
          pendingAvatarUri.toLowerCase().endsWith(".png") ||
          pendingAvatarUri.includes("png")
            ? "image/png"
            : "image/jpeg";
        body.avatarUrl = await uploadUserAvatarToSupabase(
          supabase,
          authMe.user.id,
          pendingAvatarUri,
          mime
        );
      }

      await patchAuthProfile(accessToken, body, activeProfileId);
      await refreshAuthMe();
      onClose();
    } catch (e) {
      Alert.alert(
        "",
        e instanceof Error ? e.message : t("producer.saveError")
      );
    } finally {
      setSaving(false);
    }
  };

  const displayAvatarUri = pendingAvatarUri ?? authMe?.user.avatarUrl ?? null;

  const displayName = useMemo(() => {
    const a = `${firstName} ${lastName}`.trim();
    if (a) {
      return a;
    }
    return authMe?.user.fullName?.trim() || t("producer.profileNoName");
  }, [firstName, lastName, authMe?.user.fullName, t]);

  const applyMapPick = (lat: number, lng: number) => {
    setLocLat(lat);
    setLocLng(lng);
    setLocSource("manual");
    setLocLabel((prev) =>
      prev.trim() ? prev : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    );
    setMapPickerVisible(false);
  };

  return (
    <>
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
          <Pressable
            onPress={() => void onSave()}
            disabled={saving}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t("producer.save")}
            style={styles.saveTopHit}
          >
            {saving ? (
              <ActivityIndicator size="small" color={mobileColors.accent} />
            ) : (
              <Text style={styles.saveTopText}>{t("producer.save")}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.avatarRing}>
              {displayAvatarUri ? (
                <Image
                  source={{ uri: displayAvatarUri }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                  <Ionicons
                    name="person"
                    size={44}
                    color={mobileColors.textSecondary}
                  />
                </View>
              )}
              <Pressable
                style={styles.pencilFab}
                onPress={openPhotoMenu}
                accessibilityRole="button"
                accessibilityLabel={t("producer.changePhotoTitle")}
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

          <SectionHeader label={t("producer.profileSectionPersonalize")} />
          <GroupShell>
            <GroupRow showDivider>
              <Text style={styles.rowLabel}>{t("producer.firstName")}</Text>
              <TextInput
                style={styles.rowInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor={mobileColors.textSecondary}
                autoCapitalize="words"
                placeholder="—"
              />
            </GroupRow>
            <GroupRow showDivider>
              <Text style={styles.rowLabel}>{t("producer.lastName")}</Text>
              <TextInput
                style={styles.rowInput}
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor={mobileColors.textSecondary}
                autoCapitalize="words"
                placeholder="—"
              />
            </GroupRow>
            <GroupRow showDivider={false}>
              <Text style={styles.rowLabel}>{t("producer.farmName")}</Text>
              <TextInput
                style={styles.rowInput}
                value={farmName}
                onChangeText={setFarmName}
                placeholderTextColor={mobileColors.textSecondary}
                placeholder="—"
              />
            </GroupRow>
          </GroupShell>
          <Text style={styles.hintBelow}>{t("producer.farmNameHint")}</Text>

          <SectionHeader label={t("producer.profileSectionLocation")} />
          <GroupShell>
            <GroupRow showDivider>
              <Ionicons
                name="location-outline"
                size={22}
                color={mobileColors.textSecondary}
                style={styles.rowIcon}
              />
              <TextInput
                style={[styles.rowInput, styles.rowInputGrow]}
                value={locLabel}
                onChangeText={(v) => {
                  setLocLabel(v);
                  setLocSource("manual");
                }}
                placeholder={t("producer.locationPlaceholder")}
                placeholderTextColor={mobileColors.textSecondary}
              />
            </GroupRow>
            {Platform.OS !== "web" ? (
              <Pressable
                style={({ pressed }) => [
                  styles.groupRow,
                  styles.gpsRow,
                  pressed && styles.gpsRowPressed
                ]}
                onPress={() => setMapPickerVisible(true)}
              >
                <Ionicons
                  name="map-outline"
                  size={22}
                  color={mobileColors.accent}
                  style={styles.rowIcon}
                />
                <Text style={styles.gpsLabel}>{t("producer.placeOnMap")}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={mobileColors.textSecondary}
                />
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.groupRow,
                styles.gpsRow,
                pressed && styles.gpsRowPressed
              ]}
              onPress={() => void fillGps()}
            >
              <Ionicons
                name="navigate-outline"
                size={22}
                color={mobileColors.accent}
                style={styles.rowIcon}
              />
              <Text style={styles.gpsLabel}>{t("producer.useGpsShort")}</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={mobileColors.textSecondary}
              />
            </Pressable>
          </GroupShell>

          <SectionHeader label={t("producer.profileSectionCollab")} />
          <CollaborativeAccessPanel
            farmId={authMe?.primaryFarm?.id ?? null}
            farmName={authMe?.primaryFarm?.name ?? farmName ?? null}
          />

          <SectionHeader label={t("producer.profileSectionAccount")} />
          <AccountSettingsPanel
            onBeforeNavigate={onClose}
            compact
            hideLanguagePicker
            hideActiveProfileSwitcher
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <FarmMapPickerModal
      visible={mapPickerVisible}
      onClose={() => setMapPickerVisible(false)}
      initialLat={locLat}
      initialLng={locLng}
      onConfirm={applyMapPick}
    />
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm
  },
  saveTopHit: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 36
  },
  saveTopText: {
    ...mobileTypography.body,
    color: mobileColors.accent,
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
  avatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: mobileColors.surfaceMuted
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  pencilFab: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: PENCIL,
    height: PENCIL,
    borderRadius: PENCIL / 2,
    backgroundColor: mobileColors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: mobileColors.background,
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
    color: mobileColors.textPrimary,
    textAlign: "center",
    maxWidth: "100%"
  },
  heroEmail: {
    marginTop: 6,
    ...mobileTypography.body,
    fontSize: 15,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  sectionHeader: {
    ...mobileTypography.meta,
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm,
    marginLeft: 4
  },
  groupShell: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  groupRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowIcon: {
    marginRight: mobileSpacing.sm
  },
  rowLabel: {
    flexShrink: 1,
    maxWidth: "46%",
    ...mobileTypography.body,
    fontSize: 16,
    color: mobileColors.textSecondary
  },
  rowInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 8,
    fontSize: 16,
    color: mobileColors.textPrimary,
    textAlign: "right"
  },
  rowInputGrow: {
    textAlign: "left",
    marginLeft: 0,
    flex: 1
  },
  gpsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  gpsRowPressed: {
    opacity: 0.75
  },
  gpsLabel: {
    flex: 1,
    ...mobileTypography.body,
    fontSize: 16,
    fontWeight: "500",
    color: mobileColors.accent
  },
  hintBelow: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    marginTop: mobileSpacing.xs,
    marginLeft: 4,
    marginBottom: mobileSpacing.xs
  }
});
