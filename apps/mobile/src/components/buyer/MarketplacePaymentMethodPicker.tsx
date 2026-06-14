import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMarketMoney } from "../marketplace/MarketplaceListingCard";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

export type MarketplacePaymentMethodChoice = "wallet" | "mobile_money";

type Props = {
  amount: number;
  currency: string;
  walletBalance: number;
  value: MarketplacePaymentMethodChoice;
  onChange: (method: MarketplacePaymentMethodChoice) => void;
};

export function MarketplacePaymentMethodPicker({
  amount,
  currency,
  walletBalance,
  value,
  onChange
}: Props) {
  const { t } = useTranslation();
  const walletOk = walletBalance >= amount;
  const options: {
    id: MarketplacePaymentMethodChoice;
    title: string;
    subtitle: string;
    disabled?: boolean;
  }[] = [
    {
      id: "wallet",
      title: t("buyer.wallet.payWithBalance"),
      subtitle: walletOk
        ? t("buyer.wallet.balanceAvailable", {
            amount: formatMarketMoney(Math.round(walletBalance), currency)
          })
        : t("buyer.wallet.insufficientBalance", {
            amount: formatMarketMoney(Math.round(walletBalance), currency)
          }),
      disabled: !walletOk
    },
    {
      id: "mobile_money",
      title: t("buyer.wallet.payWithMobileMoney"),
      subtitle: t("buyer.wallet.mobileMoneyHint")
    }
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("buyer.wallet.paymentMethod")}</Text>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled: opt.disabled }}
            disabled={opt.disabled}
            onPress={() => onChange(opt.id)}
            style={[
              styles.option,
              active && styles.optionActive,
              opt.disabled && styles.optionDisabled
            ]}
          >
            <View style={[styles.radio, active && styles.radioActive]} />
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, opt.disabled && styles.muted]}>
                {opt.title}
              </Text>
              <Text style={[styles.optionSub, opt.disabled && styles.muted]}>
                {opt.subtitle}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  title: {
    ...mobileTypography.sectionTitle,
    color: buyerColors.textPrimary
  },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: buyerRadius.button,
    borderWidth: 1,
    borderColor: buyerColors.border,
    backgroundColor: buyerColors.cardBg
  },
  optionActive: {
    borderColor: buyerColors.primary,
    backgroundColor: buyerColors.primaryLight
  },
  optionDisabled: { opacity: 0.55 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: buyerColors.border,
    marginTop: 2
  },
  radioActive: {
    borderColor: buyerColors.primary,
    backgroundColor: buyerColors.primary
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    color: buyerColors.textPrimary
  },
  optionSub: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  muted: { color: buyerColors.textMuted }
});
