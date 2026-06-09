import { Image, StyleSheet, Text, View } from "react-native";
import type { ChatMessageDto } from "../../lib/api";
import { parseChatImageMessage } from "../../lib/chatImageMessage";
import { parseFarmInvitationMessage } from "../../lib/farmInvitationMessage";
import { parseMarketplaceOfferMessage } from "../../lib/marketplaceOfferMessage";
import { InviteCardInChat } from "./InviteCardInChat";
import { formatPrivacyDisplayName } from "../../lib/userDisplay";
import { ProposalCardInChat } from "./ProposalCardInChat";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function isSystemLike(body: string): boolean {
  const t = body.trim();
  return (
    t.startsWith("💰") ||
    t.startsWith("✅") ||
    t.startsWith("🔄") ||
    /proposition/i.test(t.slice(0, 40))
  );
}

type Props = {
  message: ChatMessageDto;
  isMine: boolean;
};

export function MessageBubble({ message, isMine }: Props) {
  const body = message.body?.trim() ?? "";
  const invite = parseFarmInvitationMessage(body);
  if (invite) {
    return <InviteCardInChat payload={invite} isMine={isMine} />;
  }
  const offer = parseMarketplaceOfferMessage(body);
  if (offer) {
    return <ProposalCardInChat payload={offer} isMine={isMine} />;
  }
  const chatImage = parseChatImageMessage(body);
  if (chatImage) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {!isMine ? (
            <Text style={styles.senderName} numberOfLines={1}>
              {formatPrivacyDisplayName(message.sender?.fullName)}
            </Text>
          ) : null}
          <Image source={{ uri: chatImage.url }} style={styles.chatImage} resizeMode="cover" />
          <Text style={[styles.time, isMine && styles.timeMine]}>
            {formatMessageTime(message.createdAt)}
            {isMine ? "  ✓✓" : ""}
          </Text>
        </View>
      </View>
    );
  }
  if (isSystemLike(body)) {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemTx}>{body}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {!isMine ? (
          <Text style={styles.senderName} numberOfLines={1}>
            {formatPrivacyDisplayName(message.sender?.fullName)}
          </Text>
        ) : null}
        <Text style={[styles.body, isMine && styles.bodyMine]}>{message.body}</Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>
          {formatMessageTime(message.createdAt)}
          {isMine ? "  ✓✓" : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: mobileSpacing.sm,
    maxWidth: "78%"
  },
  rowMine: { alignSelf: "flex-end" },
  rowOther: { alignSelf: "flex-start" },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "100%"
  },
  bubbleMine: {
    backgroundColor: mobileColors.accent,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16
  },
  bubbleOther: {
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16
  },
  senderName: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontSize: 15,
    lineHeight: 21
  },
  bodyMine: { color: mobileColors.onAccent },
  time: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: 11,
    marginTop: 6,
    alignSelf: "flex-end"
  },
  timeMine: { color: "rgba(255,255,255,0.75)" },
  systemWrap: {
    alignSelf: "center",
    marginVertical: mobileSpacing.sm,
    maxWidth: "92%",
    backgroundColor: "#FEF3C7",
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  systemTx: {
    ...mobileTypography.meta,
    color: "#92400E",
    fontStyle: "italic",
    textAlign: "center",
    fontSize: 12
  },
  chatImage: {
    width: 220,
    height: 160,
    borderRadius: 10,
    backgroundColor: mobileColors.surfaceMuted
  }
});
