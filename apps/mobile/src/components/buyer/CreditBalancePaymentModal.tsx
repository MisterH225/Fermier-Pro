import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMarketMoney } from "../marketplace/MarketplaceListingCard";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { useSession } from "../../context/SessionContext";
import {
  MarketplacePaymentMethodPicker,
  type MarketplacePaymentMethodChoice
} from "./MarketplacePaymentMethodPicker";

type Props = {
  visible: boolean;
  onClose: () => void;
  amount: number;
  currency: string;
  walletBalance: number;
  loading?: boolean;
  onConfirm: (method: MarketplacePaymentMethodChoice) => void;
};

export function CreditBalancePaymentModal({
  visible,
  onClose,
  amount,
  currency,
  walletBalance,
  loading = false,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const { clientFeatures } = useSession();
  const walletEnabled = clientFeatures.wallet;
  const [paymentMethod, setPaymentMethod] =
    useState<MarketplacePaymentMethodChoice>("mobile_money");
  const userPickedPaymentMethod = useRef(false);

  useEffect(() => {
    if (!visible) {
      userPickedPaymentMethod.current = false;
      return;
    }
    if (userPickedPaymentMethod.current) {
      return;
    }
    if (walletEnabled && walletBalance >= amount && amount > 0) {
      setPaymentMethod("wallet");
    } else {
      setPaymentMethod("mobile_money");
    }
  }, [visible, walletBalance, amount, walletEnabled]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.credit.balance.title")}
      headerAmount={formatMarketMoney(Math.round(amount), currency)}
      dismissible={!loading}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.credit.balance.payEscrow")}
          onPress={() => onConfirm(paymentMethod)}
          loading={loading}
        />
      }
    >
      <MarketplacePaymentMethodPicker
        amount={amount}
        currency={currency}
        walletBalance={walletBalance}
        value={paymentMethod}
        onChange={(method) => {
          userPickedPaymentMethod.current = true;
          setPaymentMethod(method);
        }}
        walletEnabled={walletEnabled}
      />
    </BaseModal>
  );
}
