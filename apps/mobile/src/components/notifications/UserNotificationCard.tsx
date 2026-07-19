import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import type { UserNotificationDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  notification: UserNotificationDto;
  onPress: (notification: UserNotificationDto) => void;
  onDelete?: (id: string) => void;
};

export function UserNotificationCard({
  notification,
  onPress,
  onDelete
}: Props) {
  const { t } = useTranslation();
  const isOrder = notification.type.startsWith("merchant_order");
  const isFinanceReminder =
    notification.type === "smart_alert" &&
    String(notification.data?.ruleKey ?? "").startsWith(
      "finance-expense-inactive"
    );
  const iconBg = isOrder ? "#DBEAFE" : isFinanceReminder ? "#D1FAE5" : "#D1FAE5";
  const iconColor = isOrder ? "#1D4ED8" : "#047857";
  const iconName = isOrder
    ? "bag-handle"
    : isFinanceReminder
      ? "wallet-outline"
      : "notifications";

  const body = (
    <Pressable
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.card,
        !notification.isRead && styles.cardUnread,
        notification.isRead && styles.cardRead,
        pressed && { opacity: 0.9 }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={styles.subject} numberOfLines={2}>
            {notification.title}
          </Text>
          {!notification.isRead ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.message} numberOfLines={4}>
          {notification.body}
        </Text>
        <Text style={styles.meta}>
          {new Date(notification.createdAt).toLocaleString()}
        </Text>
      </View>
    </Pressable>
  );

  if (!onDelete) {
    return body;
  }

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable
          style={styles.swipeDelete}
          onPress={() => onDelete(notification.id)}
          accessibilityRole="button"
          accessibilityLabel={t("smartAlerts.delete")}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </Pressable>
      )}
    >
      {body}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: mobileColors.border,
    marginBottom: mobileSpacing.sm
  },
  cardUnread: { borderColor: mobileColors.accent },
  cardRead: { opacity: 0.85 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  subject: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    flex: 1
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.accent,
    marginTop: 6
  },
  message: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginTop: 2 },
  swipeDelete: {
    backgroundColor: mobileColors.error,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    marginBottom: mobileSpacing.sm,
    borderRadius: mobileRadius.md
  }
});
