import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { SecondaryButton } from "../ui/SecondaryButton";
import { getSupabase } from "../../lib/supabase";
import { uploadMarketplaceWeightPhotoToSupabase } from "../../lib/uploadMarketplaceWeightPhotoToSupabase";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type DeclaredAnimalWeight = {
  animalId: string;
  weightKg: number;
  photoUrl?: string;
};

type Props = {
  visible: boolean;
  submitting?: boolean;
  transactionId: string;
  listingId: string;
  animalIds: string[];
  priceType: string;
  onClose: () => void;
  onConfirm: (payload: {
    animalWeights?: DeclaredAnimalWeight[];
    realWeightKg?: number;
  }) => void;
};

function parseKg(raw: string): number | null {
  const kg = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

export function DeclareWeightModal({
  visible,
  submitting = false,
  transactionId,
  listingId,
  animalIds,
  priceType,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const isPerKg = priceType !== "flat";
  const [totalWeight, setTotalWeight] = useState("");
  const [weightsByAnimal, setWeightsByAnimal] = useState<Record<string, string>>(
    () => Object.fromEntries(animalIds.map((id) => [id, ""]))
  );
  const [photoByAnimal, setPhotoByAnimal] = useState<Record<string, string>>({});
  const [uploadingAnimalId, setUploadingAnimalId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setTotalWeight("");
    setWeightsByAnimal(Object.fromEntries(animalIds.map((id) => [id, ""])));
    setPhotoByAnimal({});
  }, [visible, animalIds]);

  const animalWeights = useMemo(() => {
    if (animalIds.length === 0) {
      return [] as DeclaredAnimalWeight[];
    }
    return animalIds
      .map((id): DeclaredAnimalWeight | null => {
        const kg = parseKg(weightsByAnimal[id] ?? "");
        if (kg == null) {
          return null;
        }
        const row: DeclaredAnimalWeight = {
          animalId: id,
          weightKg: kg
        };
        if (photoByAnimal[id]) {
          row.photoUrl = photoByAnimal[id];
        }
        return row;
      })
      .filter((row): row is DeclaredAnimalWeight => row != null);
  }, [animalIds, photoByAnimal, weightsByAnimal]);

  const summedWeight = useMemo(() => {
    if (animalWeights.length > 0) {
      return animalWeights.reduce((acc, row) => acc + row.weightKg, 0);
    }
    return parseKg(totalWeight);
  }, [animalWeights, totalWeight]);

  const canSubmit =
    animalIds.length > 0
      ? animalWeights.length === animalIds.length
      : summedWeight != null;

  const pickPhoto = async (animalId: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82
    });
    if (result.canceled || !result.assets[0]) {
      return;
    }
    const asset = result.assets[0];
    setUploadingAnimalId(animalId);
    try {
      const url = await uploadMarketplaceWeightPhotoToSupabase(
        supabase,
        listingId,
        transactionId,
        asset.uri,
        asset.mimeType ?? "image/jpeg",
        animalId
      );
      setPhotoByAnimal((prev) => ({ ...prev, [animalId]: url }));
    } finally {
      setUploadingAnimalId(null);
    }
  };

  const handleConfirm = () => {
    if (animalIds.length > 0) {
      onConfirm({ animalWeights });
      return;
    }
    const kg = parseKg(totalWeight);
    if (kg != null) {
      onConfirm({ realWeightKg: kg });
    }
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.transaction.declareWeightModalTitle")}
      dismissible={!submitting && uploadingAnimalId == null}
      footerPrimary={
        <View style={{ gap: mobileSpacing.sm }}>
          <PrimaryButton
            label={t("marketScreen.transaction.declareWeight")}
            onPress={handleConfirm}
            loading={submitting}
            disabled={!canSubmit || uploadingAnimalId != null}
          />
          <SecondaryButton
            label={t("common.cancel")}
            onPress={onClose}
            disabled={submitting}
          />
        </View>
      }
    >
      <Text style={styles.hint}>
        {isPerKg
          ? t("marketScreen.transaction.declareWeightPerAnimalHint")
          : t("marketScreen.transaction.weightAtDeliveryFlatHint")}
      </Text>

      {animalIds.length > 0 ? (
        animalIds.map((id, index) => (
          <View key={id} style={styles.animalRow}>
            <Text style={styles.label}>
              {t("marketScreen.transaction.animalWeightLabel", {
                index: index + 1
              })}
            </Text>
            <TextInput
              style={styles.input}
              value={weightsByAnimal[id] ?? ""}
              onChangeText={(value) =>
                setWeightsByAnimal((prev) => ({ ...prev, [id]: value }))
              }
              keyboardType="decimal-pad"
              placeholder="0,0"
            />
            <Pressable
              style={styles.photoBtn}
              onPress={() => void pickPhoto(id)}
              disabled={uploadingAnimalId != null}
            >
              {uploadingAnimalId === id ? (
                <ActivityIndicator color={mobileColors.accent} />
              ) : (
                <Text style={styles.photoBtnText}>
                  {photoByAnimal[id]
                    ? t("marketScreen.transaction.weightPhotoAdded")
                    : t("marketScreen.transaction.addWeightPhoto")}
                </Text>
              )}
            </Pressable>
          </View>
        ))
      ) : (
        <>
          <Text style={styles.label}>
            {t("marketScreen.transaction.realWeight")}
          </Text>
          <TextInput
            style={styles.input}
            value={totalWeight}
            onChangeText={setTotalWeight}
            keyboardType="decimal-pad"
            placeholder="0,0"
          />
        </>
      )}

      {summedWeight != null ? (
        <Text style={styles.total}>
          {t("marketScreen.transaction.declaredTotalWeight", {
            kg: summedWeight.toLocaleString("fr-FR", {
              maximumFractionDigits: 1
            })
          })}
        </Text>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  animalRow: {
    marginBottom: mobileSpacing.md
  },
  photoBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.xs
  },
  photoBtnText: {
    ...mobileTypography.meta,
    color: mobileColors.accent
  },
  total: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600",
    marginTop: mobileSpacing.sm
  }
});
