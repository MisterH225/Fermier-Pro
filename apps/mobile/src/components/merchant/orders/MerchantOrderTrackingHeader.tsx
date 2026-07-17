import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  orderStatusBadgeTone,
  shortOrderTrackingId,
  type OrderStatusBadgeTone
} from "../../../lib/merchantOrderTracking";
import { merchantColors, merchantRadius } from "../../../theme/merchantTheme";

const BADGE_STYLES: Record<
  OrderStatusBadgeTone,
  { bg: string; fg: string }
> = {
  neutral: { bg: "#F3F4F6", fg: "#374151" },
  info: { bg: merchantColors.primaryLight, fg: merchantColors.primaryDark },
  progress: { bg: "#E0F2FE", fg: "#0369A1" },
  success: { bg: "#DCFCE7", fg: "#166534" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
  danger: { bg: "#FCE7F3", fg: merchantColors.danger }
};

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
  const tone = orderStatusBadgeTone(status);
  const badge = BADGE_STYLES[tone];

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
      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.badgeTx, { color: badge.fg }]} numberOfLines={1}>
          {statusLabel}
        </Text>
      </View>
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
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: merchantRadius.pill,
    maxWidth: "42%"
  },
  badgeTx: { fontSize: 12, fontWeight: "800" }
});
