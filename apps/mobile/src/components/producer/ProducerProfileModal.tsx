import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { Card } from "../ui/Card";
import { PrimaryButton } from "../ui/PrimaryButton";

type ProducerProfileModalProps = {
  visible: boolean;
  onClose: () => void;
};

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("producer.profileTitle")}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>{t("producer.close")}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.section}>{t("producer.identitySection")}</Text>
          <Card>
            <Text style={styles.label}>{t("producer.photoHint")}</Text>
            <View style={styles.photoRow}>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => void pickImage("library")}
              >
                <Text style={styles.outlineBtnText}>
                  {t("producer.pickGallery")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => void pickImage("camera")}
              >
                <Text style={styles.outlineBtnText}>
                  {t("producer.pickCamera")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>{t("producer.firstName")}</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholderTextColor={mobileColors.textSecondary}
              autoCapitalize="words"
            />
            <Text style={styles.label}>{t("producer.lastName")}</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholderTextColor={mobileColors.textSecondary}
              autoCapitalize="words"
            />
            <Text style={styles.label}>{t("producer.farmName")}</Text>
            <TextInput
              style={styles.input}
              value={farmName}
              onChangeText={setFarmName}
              placeholderTextColor={mobileColors.textSecondary}
            />
            <Text style={styles.meta}>{t("producer.farmNameHint")}</Text>
          </Card>

          <Text style={styles.section}>{t("producer.locationSection")}</Text>
          <Card>
            <TextInput
              style={styles.input}
              value={locLabel}
              onChangeText={(v) => {
                setLocLabel(v);
                setLocSource("manual");
              }}
              placeholder={t("producer.locationPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
            />
            <TouchableOpacity
              style={styles.outlineBtnWide}
              onPress={() => void fillGps()}
            >
              <Text style={styles.outlineBtnText}>{t("producer.useGps")}</Text>
            </TouchableOpacity>
          </Card>

          <PrimaryButton
            label={saving ? t("producer.saving") : t("producer.save")}
            onPress={() => void onSave()}
            loading={saving}
            disabled={saving}
          />

          <Text style={[styles.section, styles.settingsHead]}>
            {t("producer.settingsSection")}
          </Text>
          <AccountSettingsPanel onBeforeNavigate={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.surface
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  modalTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 18,
    color: mobileColors.textPrimary
  },
  close: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  scroll: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.md
  },
  section: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: mobileSpacing.sm
  },
  settingsHead: {
    marginTop: mobileSpacing.lg
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 6,
    marginTop: mobileSpacing.sm
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
    lineHeight: 18
  },
  input: {
    backgroundColor: mobileColors.background,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  photoRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  outlineBtnWide: {
    marginTop: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  outlineBtnText: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: 15
  }
});
