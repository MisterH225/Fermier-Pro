import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MarketplaceListingDetail } from "../../lib/api";
import { formatMarketMoney } from "./MarketplaceListingCard";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type InitialValues = {
  offeredPrice?: number;
  advancePercentage?: number;
  balanceDueDays?: number;
  message?: string;
};

type Props = {
  visible: boolean;
  listing: MarketplaceListingDetail | null;
  submitting?: boolean;
  buyerScoreWarning?: boolean;
  mode?: "create" | "counter";
  initialValues?: InitialValues;
  onClose: () => void;
  onSubmit: (payload: {
    offeredPrice: number;
    advancePercentage: number;
    balanceDueDays: number;
    message?: string;
  }) => void;
};

const DAY_OPTIONS = [1, 2, 3, 4] as const;

export function CreditProposalModal({
  visible,
  listing,
  submitting,
  buyerScoreWarning,
  mode = "create",
  initialValues,
  onClose,
  onSubmit
}: Props) {
  const { t } = useTranslation();
  const [total, setTotal] = useState("");
  const [advancePct, setAdvancePct] = useState("30");
  const [days, setDays] = useState<number>(2);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTotal(
      initialValues?.offeredPrice != null
        ? String(initialValues.offeredPrice)
        : ""
    );
    setAdvancePct(
      initialValues?.advancePercentage != null
        ? String(initialValues.advancePercentage)
        : "30"
    );
    setDays(initialValues?.balanceDueDays ?? 2);
    setMessage(initialValues?.message ?? "");
  }, [visible, initialValues]);

  const currency = listing?.currency ?? "XOF";
  const totalNum = Number.parseFloat(total.replace(",", "."));
  const pct = Number.parseInt(advancePct, 10);
  const amounts = useMemo(() => {
    if (!Number.isFinite(totalNum) || totalNum <= 0 || !Number.isFinite(pct)) {
      return null;
    }
    const advance = Math.round((totalNum * pct) / 100);
    const balance = Math.round(totalNum - advance);
    return { advance, balance };
  }, [totalNum, pct]);

  const valid =
    Number.isFinite(totalNum) &&
    totalNum > 0 &&
    pct >= 20 &&
    pct <= 50 &&
    amounts != null &&
    amounts.balance > 0;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={
        mode === "counter"
          ? t("marketScreen.credit.counterTitle")
          : t("marketScreen.creditModal.title")
      }
      footerPrimary={
        <PrimaryButton
          label={
            mode === "counter"
              ? t("marketScreen.credit.counterSubmit")
              : t("marketScreen.creditModal.submit")
          }
          loading={submitting}
          disabled={!valid}
          onPress={() => {
            if (!valid) return;
            onSubmit({
              offeredPrice: totalNum,
              advancePercentage: pct,
              balanceDueDays: days,
              message: message.trim() || undefined
            });
          }}
        />
      }
    >
      <Text style={styles.subtitle}>{t("marketScreen.creditModal.subtitle")}</Text>
      {buyerScoreWarning ? (
        <View style={styles.warn}>
          <Text style={styles.warnTx}>{t("marketScreen.creditModal.scoreWarning")}</Text>
        </View>
      ) : null}
      <Text style={styles.label}>{t("marketScreen.creditModal.totalPrice")}</Text>
      <TextInput
        style={styles.input}
        value={total}
        onChangeText={setTotal}
        keyboardType="decimal-pad"
        placeholder={currency}
      />
      <Text style={styles.label}>{t("marketScreen.creditModal.advancePct")}</Text>
      <TextInput
        style={styles.input}
        value={advancePct}
        onChangeText={setAdvancePct}
        keyboardType="number-pad"
      />
      <Text style={styles.helper}>{t("marketScreen.creditModal.advanceHelper")}</Text>
      {amounts ? (
        <View style={styles.pills}>
          <Text style={[styles.pill, styles.pillGreen]}>
            {t("marketScreen.creditModal.advancePreview", {
              amount: formatMarketMoney(amounts.advance, currency)
            })}
          </Text>
          <Text style={[styles.pill, styles.pillAmber]}>
            {t("marketScreen.creditModal.balancePreview", {
              amount: formatMarketMoney(amounts.balance, currency)
            })}
          </Text>
        </View>
      ) : null}
      <Text style={styles.label}>{t("marketScreen.creditModal.balanceDays")}</Text>
      <View style={styles.chipRow}>
        {DAY_OPTIONS.map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, days === d && styles.chipOn]}
            onPress={() => setDays(d)}
          >
            <Text style={[styles.chipTx, days === d && styles.chipTxOn]}>
              {t("marketScreen.creditModal.dayOption", { count: d })}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("marketScreen.creditModal.message")}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder={t("marketScreen.creditModal.messagePh")}
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  warn: {
    backgroundColor: "#FFF8E6",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  warnTx: { ...mobileTypography.meta, color: "#BA7517" },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs,
    marginTop: mobileSpacing.sm
  },
  helper: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  pills: { gap: mobileSpacing.xs, marginTop: mobileSpacing.sm },
  pill: {
    ...mobileTypography.meta,
    padding: mobileSpacing.sm,
    borderRadius: mobileRadius.md
  },
  pillGreen: { backgroundColor: "#E8F8F0", color: "#1D9E75" },
  pillAmber: { backgroundColor: "#FFF4E0", color: "#BA7517" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  chipTx: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  chipTxOn: { color: mobileColors.accent, fontWeight: "700" }
});
