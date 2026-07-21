import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  merchantOrderPalette,
  OrderInfoCard,
  type OrderInfoRow
} from "../../orders";
import type { MerchantOrderDto } from "../../../lib/api";
import { formatMarketMoney } from "../../../lib/formatMoney";
import { merchantColors } from "../../../theme/merchantTheme";
import { mobileFontSize } from "../../../theme/mobileTheme";

type Props = {
  order: MerchantOrderDto;
  isSeller: boolean;
};

export function MerchantOrderDeliveryCard({ order, isSeller }: Props) {
  const { t } = useTranslation();
  const counterparty = isSeller
    ? (order.buyerName ?? t("merchant.orders.buyer"))
    : (order.sellerName ?? t("merchant.orders.seller"));
  const phone = isSeller ? order.buyerPhone : order.sellerPhone;
  const itemLabel = [
    order.productName ?? "—",
    t("merchant.orders.qtyItems", { count: order.quantity })
  ].join(" · ");
  const rows: OrderInfoRow[] = [
    {
      labelKey: isSeller
        ? "merchant.orders.deliveryDetails.receiver"
        : "merchant.orders.deliveryDetails.merchant",
      value: counterparty
    },
    {
      labelKey: "merchant.orders.deliveryDetails.contact",
      value: phone?.trim()
        ? phone
        : t("merchant.orders.deliveryDetails.noContact")
    },
    {
      labelKey: "merchant.orders.deliveryDetails.item",
      value: itemLabel
    },
    {
      labelKey: "merchant.orders.amount",
      value: formatMarketMoney(
        order.totalAmount,
        order.productCurrency || "XOF"
      )
    },
    {
      labelKey: "merchant.orders.payment",
      value:
        order.status !== "payment_pending" && order.status !== "failed"
          ? `${order.paymentMethod} · ${t("merchant.orders.paidBadge")}`
          : order.paymentMethod
    }
  ];
  if (isSeller) {
    rows.push({
      labelKey: "merchant.orders.net",
      value: formatMarketMoney(
        order.sellerNet,
        order.productCurrency || "XOF"
      )
    });
  }

  return (
    <OrderInfoCard
      titleKey="merchant.orders.deliveryDetails.title"
      icon="bicycle-outline"
      rows={rows}
      palette={merchantOrderPalette}
    >
      {order.dispute ? (
        <View style={styles.noteRow}>
          <Text style={styles.label}>{t("merchant.orders.deliveryDetails.note")}</Text>
          <View style={styles.noteValue}>
            <Ionicons name="warning" size={14} color={merchantColors.danger} />
            <Text style={styles.noteTx} numberOfLines={3}>
              {order.dispute.reason || t("merchant.orders.disputeOpen")}
            </Text>
          </View>
        </View>
      ) : null}
    </OrderInfoCard>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: mobileFontSize.sm,
    lineHeight: 16,
    fontWeight: "500",
    color: merchantColors.textSecondary,
    flexShrink: 0
  },
  noteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  noteValue: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6
  },
  noteTx: {
    flexShrink: 1,
    textAlign: "right",
    fontWeight: "700",
    fontSize: mobileFontSize.sm,
    color: merchantColors.danger
  }
});
