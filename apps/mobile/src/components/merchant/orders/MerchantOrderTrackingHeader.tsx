import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  merchantOrderPalette,
  merchantWarningOrderPalette,
  OrderStatusBadge,
  type OrderStatusTone
} from "../../orders";
import {
  orderStatusBadgeTone,
  shortOrderTrackingId
} from "../../../lib/merchantOrderTracking";
import { merchantColors } from "../../../theme/merchantTheme";

type Props = {
  orderId: string;
  status: string;
  statusLabel: string;
};

export function MerchantOrderTrackingHeader({
  orderId,
  status,
  statusLabel
}: Props) {
  const { t } = useTranslation();
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
  const palette =
    legacyTone === "warning"
      ? merchantWarningOrderPalette
      : merchantOrderPalette;

  const onCopy = async () => {
    await Clipboard.setStringAsync(trackingId);
    Alert.alert(t("merchant.orders.tracking.copied"));
  };

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Ionicons name="cube-outline" size={20} color={merchantColors.primary} />
        </View>
        <View style={styles.idBlock}>
          <Text style={styles.label}>{t("merchant.orders.tracking.label")}</Text>
          <View style={styles.idRow}>
            <Text style={styles.id} numberOfLines={1}>
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
                color={merchantColors.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </View>
      <OrderStatusBadge
        labelKey={statusLabel}
        label={statusLabel}
        tone={tone}
        palette={palette}
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
    borderRadius: 12,
    backgroundColor: merchantColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  idBlock: { flex: 1, gap: 2 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: merchantColors.textSecondary
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  id: {
    fontSize: 18,
    fontWeight: "800",
    color: merchantColors.textPrimary,
    flexShrink: 1
  },
});
