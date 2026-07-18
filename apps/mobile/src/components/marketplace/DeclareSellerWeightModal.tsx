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

type Props = {
  visible: boolean;
  submitting?: boolean;
  transactionId: string;
  listingId: string;
  buyerWeightKg?: number | null;
  /** Seuils depuis le DTO transaction — rien en dur. */
  weightArbitrationThresholds?: {
    minDiffKg: number;
    cumulativeMinDiffKg: number;
    tolerancePercent: number;
  } | null;
  onClose: () => void;
  onConfirm: (payload: { sellerDeclaredWeightKg: number; photoUrl?: string }) => void;
};

function parseKg(raw: string): number | null {
  const kg = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

export function DeclareSellerWeightModal({
  visible,
  submitting = false,
  transactionId,
  listingId,
  buyerWeightKg,
  weightArbitrationThresholds,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const [weight, setWeight] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setWeight("");
    setPhotoUrl(undefined);
  }, [visible]);

  const parsedKg = useMemo(() => parseKg(weight), [weight]);

  const pickPhoto = async () => {
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
    setUploading(true);
    try {
      const url = await uploadMarketplaceWeightPhotoToSupabase(
        supabase,
        listingId,
        transactionId,
        asset.uri,
        asset.mimeType ?? "image/jpeg",
        "seller"
      );
      setPhotoUrl(url);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    if (parsedKg == null) {
      return;
    }
    onConfirm({ sellerDeclaredWeightKg: parsedKg, photoUrl });
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.transaction.sellerDeclareWeightTitle")}
      dismissible={!submitting && !uploading}
      footerPrimary={
        <View style={{ gap: mobileSpacing.sm }}>
          <PrimaryButton
            label={t("marketScreen.transaction.sellerDeclareWeightCta")}
            onPress={handleConfirm}
            loading={submitting}
            disabled={parsedKg == null || uploading}
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
        {t("marketScreen.transaction.sellerDeclareWeightHint")}
      </Text>
      {weightArbitrationThresholds ? (
        <Text style={styles.toleranceInfo}>
          {t("marketScreen.transaction.autoToleranceHint", {
            percent: weightArbitrationThresholds.tolerancePercent,
            minKg: weightArbitrationThresholds.minDiffKg
          })}
        </Text>
      ) : null}
      {buyerWeightKg != null ? (
        <Text style={styles.buyerLine}>
          {t("marketScreen.transaction.buyerDeclaredWeight", {
            kg: buyerWeightKg.toLocaleString("fr-FR", {
              maximumFractionDigits: 1
            })
          })}
        </Text>
      ) : null}
      <Text style={styles.label}>
        {t("marketScreen.transaction.sellerWeightLabel")}
      </Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="0,0"
      />
      <Pressable
        style={styles.photoBtn}
        onPress={() => void pickPhoto()}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : (
          <Text style={styles.photoBtnText}>
            {photoUrl
              ? t("marketScreen.transaction.weightPhotoAdded")
              : t("marketScreen.transaction.addWeightPhoto")}
          </Text>
        )}
      </Pressable>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  toleranceInfo: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md,
    lineHeight: 20
  },
  buyerLine: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
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
  photoBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.xs
  },
  photoBtnText: {
    ...mobileTypography.meta,
    color: mobileColors.accent
  }
});
