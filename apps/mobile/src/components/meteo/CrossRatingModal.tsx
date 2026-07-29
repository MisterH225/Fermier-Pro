import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "../../context/SessionContext";
import {
  createBuyerCrossRating,
  createFarmMarketRating,
  createMerchantCrossRating,
  createTechnicianCrossRating
} from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { SecondaryButton } from "../ui/SecondaryButton";
import { RatingStars } from "./RatingStars";

export type CrossRatingTarget =
  | {
      kind: "buyer";
      marketplaceTransactionId?: string;
      merchantOrderId?: string;
    }
  | { kind: "merchant"; merchantOrderId: string }
  | { kind: "technician"; technicianUserId: string; farmId: string }
  | { kind: "farm"; farmId: string };

type Props = {
  visible: boolean;
  target: CrossRatingTarget | null;
  onClose: () => void;
  onSubmitted?: () => void;
  onSkipped?: () => void;
};

function titleKey(target: CrossRatingTarget): string {
  switch (target.kind) {
    case "buyer":
      return "trustScore.rate.buyerTitle";
    case "merchant":
      return "trustScore.rate.merchantTitle";
    case "technician":
      return "trustScore.rate.technicianTitle";
    case "farm":
      return "trustScore.rate.farmTitle";
  }
}

/**
 * Modal optionnelle 1–5 + commentaire privé — jamais bloquante (Passer).
 */
export function CrossRatingModal({
  visible,
  target,
  onClose,
  onSubmitted,
  onSkipped
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!visible) {
      setScore(0);
      setComment("");
    }
  }, [visible]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !target || score < 1) {
        throw new Error("INVALID_RATING");
      }
      const bodyComment = comment.trim() || undefined;
      switch (target.kind) {
        case "buyer":
          return createBuyerCrossRating(
            accessToken,
            {
              marketplaceTransactionId: target.marketplaceTransactionId,
              merchantOrderId: target.merchantOrderId,
              score,
              comment: bodyComment
            },
            activeProfileId
          );
        case "merchant":
          return createMerchantCrossRating(
            accessToken,
            {
              merchantOrderId: target.merchantOrderId,
              score,
              comment: bodyComment
            },
            activeProfileId
          );
        case "technician":
          return createTechnicianCrossRating(
            accessToken,
            {
              technicianUserId: target.technicianUserId,
              farmId: target.farmId,
              score,
              comment: bodyComment
            },
            activeProfileId
          );
        case "farm":
          return createFarmMarketRating(
            accessToken,
            {
              farmId: target.farmId,
              score,
              comment: bodyComment
            },
            activeProfileId
          );
      }
    },
    onSuccess: () => {
      onSubmitted?.();
      onClose();
    },
    onError: (err: Error) => {
      Alert.alert(t("common.error"), getUserFacingError(err, t));
    }
  });

  if (!target) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={() => {
        onSkipped?.();
        onClose();
      }}
      title={t(titleKey(target))}
      sheetMaxHeight="70%"
      footerPrimary={
        <View style={styles.footer}>
          <PrimaryButton
            label={t("trustScore.rate.submit")}
            onPress={() => mut.mutate()}
            loading={mut.isPending}
            disabled={score < 1 || mut.isPending}
          />
          <SecondaryButton
            label={t("trustScore.rate.skip")}
            onPress={() => {
              onSkipped?.();
              onClose();
            }}
            disabled={mut.isPending}
          />
        </View>
      }
    >
      <Text style={styles.hint}>{t("trustScore.rate.starsHint")}</Text>
      <View style={styles.starsWrap}>
        <RatingStars value={score} onChange={setScore} />
      </View>
      <Text style={styles.privateHint}>
        {t("trustScore.rate.commentPrivateHint")}
      </Text>
      <TextInput
        style={styles.input}
        placeholder={t("trustScore.rate.commentPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
        multiline
        value={comment}
        onChangeText={setComment}
        maxLength={2000}
      />
      {mut.isPending ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 8 }} />
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  starsWrap: {
    marginBottom: mobileSpacing.md,
    alignItems: "flex-start"
  },
  privateHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs
  },
  input: {
    ...mobileTypography.body,
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    textAlignVertical: "top",
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted
  },
  footer: { gap: mobileSpacing.sm, width: "100%" }
});
