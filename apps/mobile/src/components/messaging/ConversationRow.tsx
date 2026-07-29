import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChatRoomListItem } from "../../lib/api";
import {
  chatRoomInitials,
  chatRoomLastPreview,
  chatRoomLastTime,
  chatRoomListingPill,
  chatRoomTitle
} from "../../lib/messaging/chatRoomDisplay";
import { useRolePalette } from "../../hooks/useRolePalette";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

export type ConversationRowProps = {
  room: ChatRoomListItem;
  myUserId?: string;
  onPress: () => void;
  contextPill?: string | null;
  unreadCount?: number;
};

export function ConversationRow({
  room,
  myUserId,
  onPress,
  contextPill,
  unreadCount = 0
}: ConversationRowProps) {
  const palette = useRolePalette();
  const title = chatRoomTitle(room, myUserId);
  const preview = chatRoomLastPreview(room);
  const time = chatRoomLastTime(room);
  const pill = chatRoomListingPill(room, contextPill);
  const unread = (room.unreadCount ?? unreadCount) > 0;
  const badgeCount = room.unreadCount ?? unreadCount;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        unread && { backgroundColor: palette.primaryLight },
        pressed && { opacity: 0.92 }
      ]}
      onPress={onPress}
    >
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: palette.primaryLight }]}>
          <Text style={[styles.avatarTx, { color: palette.primary }]}>
            {chatRoomInitials(title)}
          </Text>
        </View>
        <View style={styles.avatarBadge}>
          <Text style={styles.avatarBadgeTx}>🐷</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text
            style={[styles.title, unread && styles.titleUnread]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
        {pill ? (
          <View style={styles.contextPill}>
            <Text style={styles.contextPillTx} numberOfLines={1}>
              {pill}
            </Text>
          </View>
        ) : null}
        <Text style={styles.preview} numberOfLines={1}>
          {preview ?? "—"}
        </Text>
      </View>
      {unread ? (
        <View style={[styles.unreadBadge, { backgroundColor: palette.primary }]}>
          <Text style={styles.unreadBadgeTx}>
            {badgeCount > 99 ? "99+" : String(badgeCount)}
          </Text>
        </View>
      ) : null}
      <Ionicons
        name="chevron-forward"
        size={18}
        color={mobileColors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.lg,
    ...mobileShadows.card
  },
  avatarWrap: {
    position: "relative",
    width: 48,
    height: 48
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    fontWeight: "800",
    fontSize: mobileFontSize.lg,
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  avatarBadgeTx: { fontSize: mobileFontSize.xs },
  body: { flex: 1, minWidth: 0, gap: 2 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    flex: 1
  },
  titleUnread: { fontWeight: "800" },
  time: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm
  },
  contextPill: {
    alignSelf: "flex-start",
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 2,
    maxWidth: "100%"
  },
  contextPillTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.xs
  },
  preview: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  unreadBadgeTx: {
    color: mobileColors.onAccent,
    fontSize: mobileFontSize.xs,
    fontWeight: "800"
  }
});
