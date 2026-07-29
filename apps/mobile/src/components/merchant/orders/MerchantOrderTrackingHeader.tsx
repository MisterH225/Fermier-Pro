import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  OrderStatusBadge,
  warningOrderPalette,
  type OrderPalette,
  type OrderStatusTone
} from "../../orders";
import { useOrderPalette } from "../../../hooks/useOrderPalette";
import {
  orderStatusBadgeTone,
  shortOrderTrackingId
} from "../../../lib/merchantOrderTracking";
import { mobileRadius, mobileFontSize } from "../../../theme/mobileTheme";

type Props = {
  orderId: string;
  status: string;
  statusLabel: string;
  palette?: OrderPalette;
};

export function MerchantOrderTrackingHeader({
  orderId,
  status,
  statusLabel,
  palette
}: Props) {
  const { t } = useTranslation();
  const rolePalette = useOrderPalette();
  const base = palette ?? rolePalette;
  const trackingId = shortOrderTrackingId(orderId);
  const legacyTone = orderStatusBadgeTone(status);
  const tone: OrderStatusTone =
    legacyTone === "info"
      ? "pending"
      : legacyTone === "progress"
        ? "active"
        : legacyTone === "warning"
          ? "danger"
          : legacyTone;
  const resolved =
    legacyTone === "warning" ? warningOrderPalette(base) : base;

  const onCopy = async () => {
    await Clipboard.setStringAsync(trackingId);
    Alert.alert(t("merchant.orders.tracking.copied"));
  };

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View
          style={[styles.iconWrap, { backgroundColor: resolved.primaryLight }]}
        >
          <Ionicons name="cube-outline" size={20} color={resolved.primary} />
        </View>
        <View style={styles.idBlock}>
          <Text style={[styles.label, { color: resolved.textSecondary }]}>
            {t("merchant.orders.tracking.label")}
          </Text>
          <View style={styles.idRow}>
            <Text
              style={[styles.id, { color: resolved.textPrimary }]}
              numberOfLines={1}
            >
              {trackingId}
            </Text>
            <Pressable
              onPress={() => void onCopy()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("merchant.orders.tracking.copy")}
            >
              <Ionicons
                name="copy-outline"
                size={16}
                color={resolved.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </View>
      <OrderStatusBadge
        labelKey={statusLabel}
        label={statusLabel}
        tone={tone}
        palette={resolved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  idBlock: { flex: 1, gap: 2 },
  label: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600"
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  id: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    flexShrink: 1
  }
});
