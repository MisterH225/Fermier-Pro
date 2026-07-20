import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type {
  BuyerMeteoDto,
  MarketplaceListingDetail,
  MarketplaceOfferBrief
} from "../../lib/api";
import { isFlatPriceListing } from "./listingPricing";
import { formatMarketMoney, parseMarketNum } from "./MarketplaceListingCard";
import { BuyerMeteoBadge } from "./BuyerMeteoBadge";
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
  offer: MarketplaceOfferBrief | null;
  buyerMeteo?: BuyerMeteoDto | null;
  onClose: () => void;
  onSubmit: (payload: {
    counterPricePerKg?: number;
    counterOfferedPrice?: number;
    message?: string;
  }) => void;
  submitting?: boolean;
};

export function CounterProposalModal({
  visible,
  listing,
  offer,
  buyerMeteo,
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

  const handleOpen = () => {
    if (flatAsk && askTotal != null) {
      setAmount(String(Math.round(askTotal)));
    } else if (askPk != null) {
      setAmount(String(askPk));
    } else {
      setAmount("");
    }
  };

  const parsed = Number.parseFloat(amount.replace(",", "."));
  const canSubmit = Boolean(
    listing && Number.isFinite(parsed) && parsed >= 0 && (!flatAsk ? wKg != null : true)
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.counterModal.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.counterModal.submit")}
          loading={submitting}
          disabled={!canSubmit}
          onPress={() => {
            if (!Number.isFinite(parsed) || parsed < 0) {
              return;
            }
            if (flatAsk) {
              onSubmit({ counterOfferedPrice: parsed });
            } else {
              onSubmit({ counterPricePerKg: parsed });
            }
          }}
        />
      }
    >
      {visible ? <View onLayout={handleOpen} /> : null}
      {offer?.buyer?.fullName ? (
        <Text style={styles.meta}>
          {t("marketScreen.counterModal.buyer")} {offer.buyer.fullName}
        </Text>
      ) : null}
      {buyerMeteo ? <BuyerMeteoBadge meteo={buyerMeteo} /> : null}
      {flatAsk && askTotal != null ? (
        <Text style={styles.meta}>
          {t("marketScreen.counterModal.askedFlat")}{" "}
          {formatMarketMoney(askTotal, listing?.currency ?? "XOF")}
        </Text>
      ) : askPk != null ? (
        <Text style={styles.meta}>
          {t("marketScreen.counterModal.asked")}{" "}
          {formatMarketMoney(askPk, listing?.currency ?? "XOF")}/kg
        </Text>
      ) : null}
      <Text style={styles.lab}>
        {flatAsk
          ? t("marketScreen.counterModal.offeredFlat")
          : t("marketScreen.counterModal.pricePerKg")}
      </Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholderTextColor={mobileColors.textSecondary}
      />
      {!flatAsk && wKg != null && Number.isFinite(parsed) ? (
        <Text style={styles.total}>
          {t("marketScreen.totalPrice")}{" "}
          {formatMarketMoney(parsed * wKg, listing?.currency ?? "XOF")}
        </Text>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
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
  total: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent,
    marginTop: mobileSpacing.sm
  }
});
