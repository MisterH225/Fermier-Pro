import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { getSupabase } from "../../lib/supabase";
import { uploadMerchantProductPhotoToSupabase } from "../../lib/uploadMerchantProductPhotoToSupabase";
import { merchantColors } from "../../theme/merchantTheme";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const THUMB = 80;
const MAX_PHOTOS = 5;

type LocalSlot = { uri: string; uploading: boolean };

type Props = {
  shopId: string | null;
  productId?: string | null;
  photoUrls: string[];
  onChange: (urls: string[]) => void;
};

export function MerchantProductPhotoGrid({
  shopId,
  productId,
  photoUrls,
  onChange
}: Props) {
  const { t } = useTranslation();
  const [localSlots, setLocalSlots] = useState<LocalSlot[]>([]);

  const canAdd =
    Boolean(shopId) && photoUrls.length + localSlots.length < MAX_PHOTOS;

  const pickAndUpload = async (source: "library" | "camera") => {
    if (!shopId) {
      Alert.alert(
        t("merchant.product.photos.shopRequiredTitle"),
        t("merchant.product.photos.shopRequiredBody")
      );
      return;
    }
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
            aspect: [4, 3],
            quality: 0.8
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8
          });
    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }
    const asset = result.assets[0];
    const localUri = asset.uri;
    const mime = asset.mimeType ?? "image/jpeg";
    setLocalSlots((s) => [...s, { uri: localUri, uploading: true }]);

    const supabase = getSupabase();
    if (!supabase) {
      setLocalSlots((s) => s.filter((x) => x.uri !== localUri));
      Alert.alert(
        t("merchant.product.photos.uploadErrorTitle"),
        t("merchant.product.photos.uploadUnavailable")
      );
      return;
    }

    try {
      const url = await uploadMerchantProductPhotoToSupabase(
        supabase,
        shopId,
        localUri,
        mime,
        productId ?? undefined
      );
      setLocalSlots((s) => s.filter((x) => x.uri !== localUri));
      onChange([...photoUrls, url]);
    } catch {
      setLocalSlots((s) => s.filter((x) => x.uri !== localUri));
      Alert.alert(
        t("merchant.product.photos.uploadErrorTitle"),
        t("merchant.product.photos.uploadErrorBody")
      );
    }
  };

  const openAddMenu = () => {
    Alert.alert(t("merchant.product.photos.addTitle"), undefined, [
      {
        text: t("merchant.product.photos.fromGallery"),
        onPress: () => void pickAndUpload("library")
      },
      {
        text: t("merchant.product.photos.fromCamera"),
        onPress: () => void pickAndUpload("camera")
      },
      { text: t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" }
    ]);
  };

  const removeAt = (index: number) => {
    onChange(photoUrls.filter((_, i) => i !== index));
  };

  const hasAnyPhoto = photoUrls.length > 0 || localSlots.length > 0;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{t("merchant.product.photos.title")}</Text>
      <Text style={styles.hint}>{t("merchant.product.photos.hint")}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
      >
        {photoUrls.map((url, index) => (
          <View key={`${url}-${index}`} style={styles.thumbWrap}>
            <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
            {index === 0 ? (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeTx}>
                  {t("merchant.product.photos.primary")}
                </Text>
              </View>
            ) : null}
            <Pressable
              style={styles.removeBtn}
              onPress={() => removeAt(index)}
              hitSlop={6}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {localSlots.map((slot) => (
          <View key={slot.uri} style={styles.thumbWrap}>
            <Image source={{ uri: slot.uri }} style={styles.thumb} resizeMode="cover" />
            {slot.uploading ? (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : null}
          </View>
        ))}
        {canAdd ? (
          <Pressable style={styles.addBtn} onPress={openAddMenu}>
            <Ionicons name="add" size={28} color={merchantColors.primary} />
          </Pressable>
        ) : null}
      </ScrollView>

      {!hasAnyPhoto ? (
        <Pressable style={styles.emptyBox} onPress={canAdd ? openAddMenu : undefined}>
          <Ionicons name="image-outline" size={32} color={merchantColors.textMuted} />
          <Text style={styles.emptyTx}>{t("merchant.product.photos.emptyHint")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: mobileSpacing.sm },
  title: {
    ...mobileTypography.cardTitle,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  strip: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: THUMB + 8
  },
  stripContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: mobileRadius.sm,
    overflow: "hidden"
  },
  thumb: {
    width: THUMB,
    height: THUMB
  },
  primaryBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    backgroundColor: merchantColors.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  primaryBadgeTx: {
    fontSize: 9,
    fontWeight: "700",
    color: merchantColors.onPrimary
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: mobileColors.error,
    alignItems: "center",
    justifyContent: "center"
  },
  addBtn: {
    width: THUMB,
    height: THUMB,
    borderRadius: mobileRadius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: merchantColors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: merchantColors.primaryLight
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  emptyBox: {
    alignItems: "center",
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: merchantColors.primaryLight,
    gap: mobileSpacing.sm
  },
  emptyTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  }
});
