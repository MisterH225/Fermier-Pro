import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChatRoomListItem } from "../../lib/api";
import { directConversationTitle } from "../../lib/api";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type ConversationItemProps = {
  room: ChatRoomListItem;
  myUserId?: string;
  onPress: () => void;
  onMessage?: () => void;
  onCall?: () => void;
};

function roomTitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.kind === "direct" && myUserId) {
    return directConversationTitle(room, myUserId);
  }
  if (room.farm?.name) {
    return room.farm.name;
  }
  return room.title?.trim() || "Conversation";
}

function roomSubtitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.farm?.name && room.kind === "direct" && myUserId) {
    const peer = directConversationTitle(room, myUserId);
    return peer;
  }
  return room.farm?.name ? "Ferme" : "Message direct";
}

function lastPreview(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.body) {
    return null;
  }
  const snippet =
    last.body.length > 72 ? `${last.body.slice(0, 70)}…` : last.body;
  return snippet;
}

function lastTime(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.createdAt) {
    return null;
  }
  const d = new Date(last.createdAt);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString(undefined, {
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short" })
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ConversationItem({
  room,
  myUserId,
  onPress,
  onMessage,
  onCall
}: ConversationItemProps) {
  const title = roomTitle(room, myUserId);
  const subtitle = roomSubtitle(room, myUserId);
  const preview = lastPreview(room);
  const time = lastTime(room);
  const unread = false;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, vetShadow.card, pressed && { opacity: 0.92 }]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarTx}>{initials(title)}</Text>
        {unread ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        ) : (
          <Text style={styles.previewMuted}>{/* empty */}</Text>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={onMessage} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={18} color={vetColors.primary} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onCall} hitSlop={8}>
          <Ionicons name="call-outline" size={18} color={vetColors.primary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    gap: mobileSpacing.md,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: { fontWeight: "800", fontSize: 16, color: vetColors.primary },
  unreadDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: vetColors.primary,
    borderWidth: 2,
    borderColor: vetColors.cardBg
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: vetColors.textPrimary,
    flex: 1
  },
  time: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    fontSize: 11
  },
  subtitle: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary
  },
  preview: {
    ...mobileTypography.meta,
    color: vetColors.textPrimary,
    marginTop: 2
  },
  previewMuted: { height: 14 },
  actions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  }
});
