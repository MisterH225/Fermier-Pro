import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { MerchantOrderDto } from "../../../lib/api";
import { formatMarketMoney } from "../../../lib/formatMoney";
import { merchantColors, merchantRadius, merchantShadow } from "../../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";

type Props = {
  order: MerchantOrderDto;
  isSeller: boolean;
};

function Row({
  label,
  value,
  valueDanger
}: {
  label: string;
  value: string;
  valueDanger?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, valueDanger && styles.valueDanger]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

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

  return (
    <View style={[styles.card, merchantShadow.card]}>
      <View style={styles.head}>
        <Ionicons name="bicycle-outline" size={18} color={merchantColors.primary} />
        <Text style={styles.headTx}>{t("merchant.orders.deliveryDetails.title")}</Text>
      </View>

      <Row
        label={
          isSeller
            ? t("merchant.orders.deliveryDetails.receiver")
            : t("merchant.orders.deliveryDetails.merchant")
        }
        value={counterparty}
      />
      <Row
        label={t("merchant.orders.deliveryDetails.contact")}
        value={phone?.trim() ? phone : t("merchant.orders.deliveryDetails.noContact")}
      />
      <Row label={t("merchant.orders.deliveryDetails.item")} value={itemLabel} />
      <Row
        label={t("merchant.orders.amount")}
        value={formatMarketMoney(order.totalAmount, order.productCurrency || "XOF")}
      />
      <Row
        label={t("merchant.orders.payment")}
        value={
          order.status !== "payment_pending" && order.status !== "failed"
            ? `${order.paymentMethod} · ${t("merchant.orders.paidBadge")}`
            : order.paymentMethod
        }
      />
      {isSeller ? (
        <Row
          label={t("merchant.orders.net")}
          value={formatMarketMoney(order.sellerNet, order.productCurrency || "XOF")}
        />
      ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border,
    gap: 12
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  headTx: {
    fontSize: 15,
    fontWeight: "800",
    color: merchantColors.textPrimary
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  label: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    flexShrink: 0
  },
  value: {
    flex: 1,
    textAlign: "right",
    fontWeight: "700",
    fontSize: 14,
    color: merchantColors.textPrimary
  },
  valueDanger: { color: merchantColors.danger },
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
    fontSize: 13,
    color: merchantColors.danger
  }
});
