import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AdminMessageDto, AdminMessageTypeDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const TYPE_META: Record<
  AdminMessageTypeDto,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  warning: { icon: "warning", color: "#B45309", bg: "#FEF3C7" },
  info: { icon: "information-circle", color: "#1D4ED8", bg: "#DBEAFE" },
  notification: { icon: "megaphone", color: "#047857", bg: "#D1FAE5" }
};

type Props = {
  msg: AdminMessageDto;
  onMarkRead?: (id: string) => void;
  adminTag?: string;
};

export function AdminMessageCard({ msg, onMarkRead, adminTag }: Props) {
  const meta = TYPE_META[msg.type] ?? TYPE_META.notification;

  return (
    <Pressable
      onPress={() => !msg.isRead && onMarkRead?.(msg.id)}
      style={({ pressed }) => [
        styles.card,
        !msg.isRead && styles.cardUnread,
        msg.isRead && styles.cardRead,
        pressed && { opacity: 0.9 }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={styles.subject} numberOfLines={2}>
            {msg.subject}
          </Text>
          {!msg.isRead ? <View style={styles.dot} /> : null}
        </View>
        {adminTag ? (
          <View style={styles.tag}>
            <Text style={styles.tagTx}>{adminTag}</Text>
          </View>
        ) : null}
        <Text style={styles.message} numberOfLines={4}>
          {msg.message}
        </Text>
        <Text style={styles.meta}>
          {new Date(msg.sentAt).toLocaleString()}
          {msg.admin.fullName ? ` · ${msg.admin.fullName}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  cardUnread: {
    borderColor: mobileColors.accent
  },
  cardRead: {
    opacity: 0.72
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.accent
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill,
    backgroundColor: `${mobileColors.accent}22`
  },
  tagTx: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  subject: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    color: mobileColors.textPrimary,
    flex: 1
  },
  message: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  }
});
