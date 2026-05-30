import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { MarketplaceListingDetail } from "../../lib/api";
import { isFlatPriceListing } from "./listingPricing";
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
    proposedPricePerKg?: number;
    offeredPrice?: number;
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
  const flatAsk = isFlatPriceListing(listing?.category ?? null);
  const wKg = parseMarketNum(listing?.totalWeightKg);
  const askPk = parseMarketNum(listing?.pricePerKg);
  const askTotal = parseMarketNum(listing?.totalPrice);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const handleOpen = () => {
    if (flatAsk && askTotal != null) {
      setAmount(String(Math.round(askTotal)));
    } else if (askPk != null) {
      setAmount(String(askPk));
    } else {
      setAmount("");
    }
    setMessage("");
  };

  const parsed = Number.parseFloat(amount.replace(",", "."));
  const canSubmit = Boolean(
    listing && Number.isFinite(parsed) && parsed >= 0 && (!flatAsk ? wKg != null : true)
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.proposalModal.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.proposalModal.submit")}
          loading={submitting}
          disabled={!canSubmit}
          onPress={() => {
            if (!Number.isFinite(parsed) || parsed < 0) {
              return;
            }
            if (flatAsk) {
              onSubmit({
                offeredPrice: parsed,
                message: message.trim() || undefined
              });
            } else {
              onSubmit({
                proposedPricePerKg: parsed,
                message: message.trim() || undefined
              });
            }
          }}
        />
      }
    >
      {visible ? <View onLayout={handleOpen} /> : null}
      {listing ? (
        <>
          <Text style={styles.hint}>{listing.title}</Text>
          {flatAsk ? (
            askTotal != null ? (
              <Text style={styles.meta}>
                {t("marketScreen.proposalModal.askedFlat")}{" "}
                {formatMarketMoney(askTotal, listing.currency)}
              </Text>
            ) : null
          ) : (
            <>
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
            </>
          )}
          <Text style={styles.lab}>
            {flatAsk
              ? t("marketScreen.proposalModal.offeredFlat")
              : t("marketScreen.proposalModal.pricePerKg")}
          </Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={mobileColors.textSecondary}
          />
          {!flatAsk && wKg != null && Number.isFinite(parsed) ? (
            <Text style={styles.total}>
              {t("marketScreen.totalPrice")}{" "}
              {formatMarketMoney(parsed * wKg, listing.currency)}
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
