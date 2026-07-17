import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  status: string;
  role: "buyer" | "seller";
};

function noticeKey(status: string, role: "buyer" | "seller") {
  if (status === "BUYER_RECEIVED") {
    return "marketScreen.transaction.finalizing";
  }
  if (status === "WEIGHT_DISPUTED") {
    return "marketScreen.transaction.weightDisputed";
  }
  if (status === "DELIVERY_DISPUTED") {
    return "marketScreen.transaction.deliveryDisputed";
  }

  const byRole: Record<string, Partial<Record<typeof role, string>>> = {
    PAYMENT_PENDING: {
      seller: "marketScreen.transaction.sellerWaitPayment"
    },
    PAYMENT_HELD: {
      buyer: "marketScreen.transaction.buyerProposePickup",
      seller: "marketScreen.transaction.sellerWaitBuyerPickup"
    },
    PICKUP_PROPOSED: {
      buyer: "marketScreen.transaction.buyerWaitPickupConfirm",
      seller: "marketScreen.transaction.sellerConfirmPickup"
    },
    PICKUP_SCHEDULED: {
      buyer: "marketScreen.transaction.buyerDeclareWeight",
      seller: "marketScreen.transaction.sellerWaitWeight"
    },
    WEIGHT_VALIDATED: {
      buyer: "marketScreen.transaction.buyerWaitHandover",
      seller: "marketScreen.transaction.sellerConfirmHandover"
    },
    SELLER_SHIPPED: {
      buyer: "marketScreen.transaction.buyerWaitReceipt",
      seller: "marketScreen.transaction.sellerWaitReceipt"
    }
  };
  return byRole[status]?.[role] ?? null;
}

export function MarketplaceTransactionStatusNotice({ status, role }: Props) {
  const { t } = useTranslation();
  const labelKey = noticeKey(status, role);
  if (!labelKey) return null;

  const danger = status.includes("DISPUTED");
  return (
    <View
      style={[
        styles.notice,
        danger && {
          borderColor: mobileColors.error,
          backgroundColor: mobileStatusSurfaces.errorBg
        }
      ]}
    >
      <Text style={[styles.text, danger && { color: mobileColors.error }]}>
        {t(labelKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.background,
    padding: mobileSpacing.md
  },
  text: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 22
  }
});
