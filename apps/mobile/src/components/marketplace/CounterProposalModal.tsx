import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type {
  MarketplaceListingDetail,
  MarketplaceOfferBrief
} from "../../lib/api";
import { formatMarketMoney, parseMarketNum } from "./MarketplaceListingCard";
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
  onClose: () => void;
  onSubmit: (payload: { counterPricePerKg: number; message?: string }) => void;
  submitting?: boolean;
};

export function CounterProposalModal({
  visible,
  listing,
  offer,
  onClose,
  onSubmit,
  submitting
}: Props) {
  const { t } = useTranslation();
  const wKg = parseMarketNum(listing?.totalWeightKg);
  const askPk = parseMarketNum(listing?.pricePerKg);
  const [pricePerKg, setPricePerKg] = useState("");

  const total = useMemo(() => {
    const p = Number.parseFloat(pricePerKg.replace(",", "."));
    if (!Number.isFinite(p) || wKg == null) return null;
    return p * wKg;
  }, [pricePerKg, wKg]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.counterModal.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.counterModal.submit")}
          loading={submitting}
          disabled={!listing || wKg == null}
          onPress={() => {
            const p = Number.parseFloat(pricePerKg.replace(",", "."));
            if (!Number.isFinite(p) || p < 0) return;
            onSubmit({ counterPricePerKg: p });
          }}
        />
      }
    >
      {visible && askPk != null && pricePerKg === "" ? (
        <View
          onLayout={() => setPricePerKg(String(askPk))}
        />
      ) : null}
      {offer?.buyer?.fullName ? (
        <Text style={styles.meta}>
          {t("marketScreen.counterModal.buyer")} {offer.buyer.fullName}
        </Text>
      ) : null}
      {askPk != null ? (
        <Text style={styles.meta}>
          {t("marketScreen.counterModal.asked")}{" "}
          {formatMarketMoney(askPk, listing?.currency ?? "XOF")}/kg
        </Text>
      ) : null}
      <Text style={styles.lab}>{t("marketScreen.counterModal.pricePerKg")}</Text>
      <TextInput
        style={styles.input}
        value={pricePerKg}
        onChangeText={setPricePerKg}
        keyboardType="decimal-pad"
        placeholderTextColor={mobileColors.textSecondary}
      />
      {total != null && listing ? (
        <Text style={styles.total}>
          {t("marketScreen.totalPrice")}{" "}
          {formatMarketMoney(total, listing.currency)}
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
