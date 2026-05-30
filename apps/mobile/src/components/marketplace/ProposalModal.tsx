import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { MarketplaceListingDetail } from "../../lib/api";
import { parseMarketNum, formatMarketMoney } from "./MarketplaceListingCard";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";

type Props = {
  visible: boolean;
  listing: MarketplaceListingDetail | null;
  onClose: () => void;
  onSubmit: (payload: {
    proposedPricePerKg: number;
    message?: string;
  }) => void;
  submitting?: boolean;
};

export function ProposalModal({
  visible,
  listing,
  onClose,
  onSubmit,
  submitting
}: Props) {
  const { t } = useTranslation();
  const wKg = parseMarketNum(listing?.totalWeightKg);
  const askPk = parseMarketNum(listing?.pricePerKg);
  const [pricePerKg, setPricePerKg] = useState("");
  const [message, setMessage] = useState("");

  const total = useMemo(() => {
    const p = Number.parseFloat(pricePerKg.replace(",", "."));
    if (!Number.isFinite(p) || wKg == null) return null;
    return p * wKg;
  }, [pricePerKg, wKg]);

  const handleOpen = () => {
    if (askPk != null) {
      setPricePerKg(String(askPk));
    } else {
      setPricePerKg("");
    }
    setMessage("");
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.proposalModal.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.proposalModal.submit")}
          loading={submitting}
          disabled={!listing || wKg == null}
          onPress={() => {
            const p = Number.parseFloat(pricePerKg.replace(",", "."));
            if (!Number.isFinite(p) || p < 0) return;
            onSubmit({
              proposedPricePerKg: p,
              message: message.trim() || undefined
            });
          }}
        />
      }
    >
      {visible ? <View onLayout={handleOpen} /> : null}
      {listing ? (
        <>
          <Text style={styles.hint}>{listing.title}</Text>
          {wKg != null ? (
            <Text style={styles.meta}>
              {t("marketScreen.totalWeight")}{" "}
              {wKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg
            </Text>
          ) : (
            <Text style={styles.warn}>
              {t("marketScreen.proposalModal.noWeight")}
            </Text>
          )}
          {askPk != null ? (
            <Text style={styles.meta}>
              {t("marketScreen.proposalModal.asked")}{" "}
              {formatMarketMoney(askPk, listing.currency)}/kg
            </Text>
          ) : null}
          <Text style={styles.lab}>{t("marketScreen.proposalModal.pricePerKg")}</Text>
          <TextInput
            style={styles.input}
            value={pricePerKg}
            onChangeText={setPricePerKg}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={mobileColors.textSecondary}
          />
          {total != null ? (
            <Text style={styles.total}>
              {t("marketScreen.totalPrice")}{" "}
              {formatMarketMoney(total, listing.currency)}
            </Text>
          ) : null}
          <Text style={styles.lab}>{t("marketScreen.proposalModal.message")}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder={t("marketScreen.proposalModal.messagePlaceholder")}
            placeholderTextColor={mobileColors.textSecondary}
          />
        </>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  warn: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    marginBottom: mobileSpacing.sm
  },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md,
    marginBottom: 4
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  total: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent,
    marginTop: mobileSpacing.sm
  }
});
