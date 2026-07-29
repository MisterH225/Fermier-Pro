import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  OrderInfoCard,
  type OrderInfoRow,
  type OrderPalette
} from "../../orders";
import { useOrderPalette } from "../../../hooks/useOrderPalette";
import type { MerchantOrderDto } from "../../../lib/api";
import { formatMarketMoney } from "../../../lib/formatMoney";
import { mobileFontSize } from "../../../theme/mobileTheme";

type Props = {
  order: MerchantOrderDto;
  isSeller: boolean;
  palette?: OrderPalette;
};

export function MerchantOrderDeliveryCard({ order, isSeller, palette }: Props) {
  const { t } = useTranslation();
  const rolePalette = useOrderPalette();
  const resolved = palette ?? rolePalette;
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
          ? `${t(`merchant.orders.paymentMethods.${order.paymentMethod}`, {
              defaultValue: t("merchant.orders.paymentMethods.unknown")
            })} · ${t("merchant.orders.paidBadge")}`
          : t(`merchant.orders.paymentMethods.${order.paymentMethod}`, {
              defaultValue: t("merchant.orders.paymentMethods.unknown")
            })
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
      palette={resolved}
    >
      {order.dispute ? (
        <View style={styles.noteRow}>
          <Text style={[styles.label, { color: resolved.textSecondary }]}>
            {t("merchant.orders.deliveryDetails.note")}
          </Text>
          <View style={styles.noteValue}>
            <Ionicons name="warning" size={14} color={resolved.danger} />
            <Text style={[styles.noteTx, { color: resolved.danger }]} numberOfLines={3}>
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
    fontSize: mobileFontSize.sm
  }
});
