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

export type SaleConfirmPayload = {
  offerId: string;
  soldWeightKg: number;
  totalPrice: number;
  soldAt?: string;
  notes?: string;
};

type Props = {
  visible: boolean;
  listing: MarketplaceListingDetail | null;
  offer: MarketplaceOfferBrief | null;
  onClose: () => void;
  onConfirm: (payload: SaleConfirmPayload) => void;
  submitting?: boolean;
};

export function SaleConfirmModal({
  visible,
  listing,
  offer,
  onClose,
  onConfirm,
  submitting
}: Props) {
  const { t } = useTranslation();
  const defaultWeight = parseMarketNum(listing?.totalWeightKg);
  const defaultTotal = parseMarketNum(offer?.offeredPrice);

  const [weightStr, setWeightStr] = useState("");
  const [totalStr, setTotalStr] = useState("");
  const [notes, setNotes] = useState("");

  const totalComputed = useMemo(() => {
    const n = Number.parseFloat(totalStr.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }, [totalStr]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.saleModal.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.saleModal.confirm")}
          loading={submitting}
          disabled={!offer || !listing}
          onPress={() => {
            if (!offer) return;
            const w = Number.parseFloat(weightStr.replace(",", "."));
            const total = totalComputed;
            if (!Number.isFinite(w) || w <= 0 || total == null || total <= 0) {
              return;
            }
            onConfirm({
              offerId: offer.id,
              soldWeightKg: w,
              totalPrice: total,
              soldAt: new Date().toISOString(),
              notes: notes.trim() || undefined
            });
          }}
        />
      }
    >
      {visible && defaultWeight != null && weightStr === "" ? (
        <View onLayout={() => setWeightStr(String(defaultWeight))} />
      ) : null}
      {visible && defaultTotal != null && totalStr === "" ? (
        <View onLayout={() => setTotalStr(String(defaultTotal))} />
      ) : null}
      {offer?.buyer?.fullName ? (
        <Text style={styles.row}>
          {t("marketScreen.saleModal.buyer")}{" "}
          <Text style={styles.bold}>{offer.buyer.fullName}</Text>
        </Text>
      ) : null}
      {listing && totalComputed != null ? (
        <Text style={styles.summary}>
          {formatMarketMoney(totalComputed, listing.currency)}
        </Text>
      ) : null}
      <Text style={styles.lab}>{t("marketScreen.saleModal.weight")}</Text>
      <TextInput
        style={styles.input}
        value={weightStr}
        onChangeText={setWeightStr}
        keyboardType="decimal-pad"
        placeholderTextColor={mobileColors.textSecondary}
      />
      <Text style={styles.lab}>{t("marketScreen.saleModal.total")}</Text>
      <TextInput
        style={styles.input}
        value={totalStr}
        onChangeText={setTotalStr}
        keyboardType="decimal-pad"
        placeholderTextColor={mobileColors.textSecondary}
      />
      <Text style={styles.lab}>{t("marketScreen.saleModal.notes")}</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholderTextColor={mobileColors.textSecondary}
      />
      <Text style={styles.footer}>{t("marketScreen.saleModal.footer")}</Text>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  row: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  bold: { fontWeight: "700", color: mobileColors.textPrimary },
  summary: {
    ...mobileTypography.title,
    color: mobileColors.accent,
    marginBottom: mobileSpacing.md
  },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
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
    minHeight: 72,
    textAlignVertical: "top"
  },
  footer: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.lg,
    lineHeight: 18
  }
});
