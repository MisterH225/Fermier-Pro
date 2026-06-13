import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
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
import type { AnimalListItem } from "../../lib/api";
import { getSupabase } from "../../lib/supabase";
import { uploadListingPhotoToSupabase } from "../../lib/uploadListingPhotoToSupabase";
import { DefaultPigImage } from "../common/DefaultPigImage";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const THUMB = 80;
const MAX_PHOTOS = 5;

type Slot =
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string; uploading: boolean };

type Props = {
  farmId: string | null;
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  animals?: AnimalListItem[];
  selectedAnimalIds?: string[];
};

export function PhotoUploadGrid({
  farmId,
  photoUrls,
  onChange,
  animals = [],
  selectedAnimalIds = []
}: Props) {
  const { t } = useTranslation();
  const [localSlots, setLocalSlots] = useState<Slot[]>([]);

  const firstAnimalWithPhoto = useMemo(() => {
    for (const id of selectedAnimalIds) {
      const a = animals.find((x) => x.id === id);
      if (a?.photoUrl?.trim()) {
        return a;
      }
    }
    return null;
  }, [animals, selectedAnimalIds]);

  const showUseAnimalPhoto =
    Boolean(firstAnimalWithPhoto?.photoUrl) &&
    photoUrls.length === 0 &&
    localSlots.length === 0;

  const canAdd =
    Boolean(farmId) &&
    photoUrls.length + localSlots.length < MAX_PHOTOS;

  const pickAndUpload = async (source: "library" | "camera") => {
    if (!farmId) {
      Alert.alert(
        t("marketScreen.createForm.photos.farmRequiredTitle"),
        t("marketScreen.createForm.photos.farmRequiredBody")
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
    const slotKey = localUri;
    setLocalSlots((s) => [...s, { kind: "local", uri: localUri, uploading: true }]);

    const supabase = getSupabase();
    if (!supabase) {
      setLocalSlots((s) => s.filter((x) => x.kind !== "local" || x.uri !== slotKey));
      Alert.alert(
        t("marketScreen.createForm.photos.uploadErrorTitle"),
        t("marketScreen.createForm.photos.uploadUnavailable")
      );
      return;
    }

    try {
      const url = await uploadListingPhotoToSupabase(
        supabase,
        farmId,
        localUri,
        mime
      );
      setLocalSlots((s) => s.filter((x) => x.kind !== "local" || x.uri !== slotKey));
      onChange([...photoUrls, url]);
    } catch {
      setLocalSlots((s) => s.filter((x) => x.kind !== "local" || x.uri !== slotKey));
      Alert.alert(
        t("marketScreen.createForm.photos.uploadErrorTitle"),
        t("marketScreen.createForm.photos.uploadErrorBody")
      );
    }
  };

  const openAddMenu = () => {
    Alert.alert(
      t("marketScreen.createForm.photos.addTitle"),
      undefined,
      [
        {
          text: t("marketScreen.createForm.photos.fromGallery"),
          onPress: () => void pickAndUpload("library")
        },
        {
          text: t("marketScreen.createForm.photos.fromCamera"),
          onPress: () => void pickAndUpload("camera")
        },
        { text: t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" }
      ]
    );
  };

  const removeAt = (index: number) => {
    onChange(photoUrls.filter((_, i) => i !== index));
  };

  const useAnimalPhoto = () => {
    const url = firstAnimalWithPhoto?.photoUrl?.trim();
    if (!url) {
      return;
    }
    onChange([url]);
  };

  const hasAnyPhoto = photoUrls.length > 0 || localSlots.length > 0;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{t("marketScreen.createForm.photos.title")}</Text>

      {showUseAnimalPhoto && firstAnimalWithPhoto ? (
        <View style={styles.animalOffer}>
          <Text style={styles.animalOfferTx}>
            {t("marketScreen.createForm.photos.animalPhotoOffer", {
              label:
                firstAnimalWithPhoto.tagCode?.trim() ||
                firstAnimalWithPhoto.publicId
            })}
          </Text>
          <View style={styles.animalOfferActions}>
            <Pressable style={styles.useBtn} onPress={useAnimalPhoto}>
              <Text style={styles.useBtnTx}>
                {t("marketScreen.createForm.photos.useAnimalPhoto")}
              </Text>
            </Pressable>
            <Pressable style={styles.ownBtn} onPress={openAddMenu}>
              <Text style={styles.ownBtnTx}>
                {t("marketScreen.createForm.photos.addOwn")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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
                  {t("marketScreen.createForm.photos.primary")}
                </Text>
              </View>
            ) : null}
            <Pressable
              style={styles.removeBtn}
              onPress={() => removeAt(index)}
              hitSlop={6}
            >
              <Ionicons name="close" size={14} color={mobileColors.onAccent} />
            </Pressable>
          </View>
        ))}
        {localSlots.map((slot) =>
          slot.kind === "local" ? (
            <View key={slot.uri} style={styles.thumbWrap}>
              <Image source={{ uri: slot.uri }} style={styles.thumb} resizeMode="cover" />
              {slot.uploading ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color={mobileColors.onAccent} size="small" />
                </View>
              ) : null}
            </View>
          ) : null
        )}
        {canAdd ? (
          <Pressable style={styles.addBtn} onPress={openAddMenu}>
            <Ionicons name="add" size={28} color={mobileColors.accent} />
          </Pressable>
        ) : null}
      </ScrollView>

      {!hasAnyPhoto ? (
        <View style={styles.emptyPreview}>
          <DefaultPigImage height={100} />
          <Text style={styles.emptyTx}>
            {t("marketScreen.createForm.photos.emptyHint")}
          </Text>
        </View>
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
    backgroundColor: mobileColors.accent,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  primaryBadgeTx: {
    fontSize: 9,
    fontWeight: "700",
    color: mobileColors.onAccent
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
    borderColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.accentSoft
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  animalOffer: {
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    gap: mobileSpacing.sm
  },
  animalOfferTx: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontSize: 14
  },
  animalOfferActions: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  useBtn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.accent
  },
  useBtnTx: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.onAccent
  },
  ownBtn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  ownBtnTx: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  emptyPreview: {
    alignItems: "center",
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: "#F5F5F5",
    gap: mobileSpacing.sm
  },
  emptyTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  }
});
