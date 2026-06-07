import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChatRoomListItem } from "../../lib/api";
import { directConversationTitle } from "../../lib/api";
import {
  formatOfferPreview,
  parseMarketplaceOfferMessage
} from "../../lib/marketplaceOfferMessage";
import { formatPrivacyDisplayName } from "../../lib/userDisplay";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type ConversationRowProps = {
  room: ChatRoomListItem;
  myUserId?: string;
  onPress: () => void;
  contextPill?: string | null;
  unreadCount?: number;
};

function roomTitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.kind === "direct" && myUserId) {
    const peer = room.members?.find((m) => m.userId !== myUserId)?.user;
    if (peer?.fullName) {
      return formatPrivacyDisplayName(peer.fullName);
    }
    return directConversationTitle(room, myUserId);
  }
  if (room.farm?.name) {
    return room.farm.name;
  }
  return room.title?.trim() || "Conversation";
}

function lastPreview(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.body?.trim()) {
    return null;
  }
  const body = last.body.trim();
  const offer = parseMarketplaceOfferMessage(body);
  const text = offer ? formatOfferPreview(offer) : body;
  return text.length > 80 ? `${text.slice(0, 78)}…` : text;
}

function listingContextPill(
  room: ChatRoomListItem,
  contextPill?: string | null
): string | null {
  if (contextPill) {
    return contextPill;
  }
  const title = room.marketplaceListing?.title?.trim();
  return title ? `Annonce · ${title}` : null;
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

export function ConversationRow({
  room,
  myUserId,
  onPress,
  contextPill,
  unreadCount = 0
}: ConversationRowProps) {
  const title = roomTitle(room, myUserId);
  const preview = lastPreview(room);
  const time = lastTime(room);
  const pill = listingContextPill(room, contextPill);
  const unread = (room.unreadCount ?? unreadCount) > 0;
  const badgeCount = room.unreadCount ?? unreadCount;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        pressed && { opacity: 0.92 }
      ]}
      onPress={onPress}
    >
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTx}>{initials(title)}</Text>
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
        <View style={styles.unreadBadge}>
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
  rowUnread: {
    backgroundColor: mobileColors.accentSoft
  },
  avatarWrap: {
    position: "relative",
    width: 48,
    height: 48
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    fontWeight: "800",
    fontSize: 16,
    color: mobileColors.accent
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  avatarBadgeTx: { fontSize: 10 },
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
    fontSize: 12
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
    fontSize: 11
  },
  preview: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: 13
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  unreadBadgeTx: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800"
  }
});
