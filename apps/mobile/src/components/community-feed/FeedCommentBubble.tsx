import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FeedCommentDto } from "../../lib/api/community-feed";
import { ProfileBadge } from "../feed/ProfileBadge";
import { ModerationWarningBanner } from "../feed/ModerationWarningBanner";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { FeedAvatar } from "./FeedAvatar";
import { FeedCommentInputBar } from "./FeedCommentInputBar";
import { formatFeedTime, resolveAuthorDisplayName } from "./feedDisplayUtils";

type Props = {
  comment: FeedCommentDto;
  postId: string;
  depth: number;
  canComment: boolean;
  onComment: (postId: string, body: string, parentCommentId?: string) => Promise<void>;
  onLike: (commentId: string) => Promise<void>;
};

export function FeedCommentBubble({
  comment,
  postId,
  depth,
  canComment,
  onComment,
  onLike
}: Props) {
  const { t } = useTranslation();
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyModWarning, setReplyModWarning] = useState<string | null>(null);

  const displayName = resolveAuthorDisplayName(comment);
  const replyCount = comment.replies?.length ?? 0;
  const time = formatFeedTime(comment.createdAt);

  const handleSendReply = () => {
    if (!reply.trim() || sending) {
      return;
    }
    setSending(true);
    void onComment(postId, reply.trim(), comment.id)
      .then(() => {
        setReply("");
        setReplyOpen(false);
        setReplyModWarning(null);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : t("feed.commentBlocked", "Commentaire bloqué par la modération.");
        setReplyModWarning(message);
        Alert.alert(t("moderation.blockedTitle", "Message bloqué"), message);
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <View style={[styles.wrap, depth > 0 && styles.replyWrap]}>
      <FeedAvatar
        displayName={comment.isAnonymous ? null : comment.authorDisplayName}
        profileType={comment.authorProfileType}
        anonymous={comment.isAnonymous}
        size={depth > 0 ? "sm" : "md"}
        imageUrl={comment.authorAvatarUrl}
        isOnline={comment.isAnonymous ? undefined : comment.authorIsOnline}
      />
      <View style={styles.content}>
        <View style={styles.bubble}>
          <View style={styles.bubbleHeader}>
            <View style={styles.bubbleHeaderLeft}>
              <Text style={styles.authorName}>{displayName}</Text>
              {time ? <Text style={styles.time}>{time}</Text> : null}
            </View>
          </View>
          <ProfileBadge
            profileType={comment.authorProfileType}
            anonymous={comment.isAnonymous}
          />
          <Text style={styles.body}>{comment.body}</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => void onLike(comment.id)} style={styles.actionBtn}>
              <Text style={[styles.actionLabel, comment.likedByMe && styles.actionLabelActive]}>
                {t("feed.like", "J'aime")}
              </Text>
            </Pressable>
            {comment.likeCount > 0 ? (
              <View style={styles.reactionCount}>
                <Ionicons
                  name="thumbs-up"
                  size={14}
                  color={comment.likedByMe ? mobileColors.accent : mobileColors.textSecondary}
                />
                <Text style={styles.reactionTx}>{comment.likeCount}</Text>
              </View>
            ) : null}
            {canComment ? (
              <Pressable onPress={() => setReplyOpen((v) => !v)} style={styles.actionBtn}>
                <Text style={styles.actionLabel}>
                  {t("feed.reply", "Répondre")}
                  {replyCount > 0 ? ` · ${replyCount}` : ""}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {replyOpen && canComment ? (
          <FeedCommentInputBar
            value={reply}
            onChangeText={(value) => {
              setReply(value);
              setReplyModWarning(null);
            }}
            onSend={handleSendReply}
            sending={sending}
            placeholder={t("feed.replyPlaceholder", "Votre réponse…")}
          />
        ) : null}
        {replyModWarning ? (
          <ModerationWarningBanner message={replyModWarning} severity="high" />
        ) : null}

        {(comment.replies ?? []).map((child) => (
          <FeedCommentBubble
            key={child.id}
            comment={child}
            postId={postId}
            depth={depth + 1}
            canComment={canComment}
            onComment={onComment}
            onLike={onLike}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  replyWrap: {
    marginLeft: mobileSpacing.md
  },
  content: {
    flex: 1,
    minWidth: 0
  },
  bubble: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.lg,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  bubbleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  bubbleHeaderLeft: {
    flex: 1
  },
  authorName: {
    ...mobileTypography.meta,
    fontWeight: "700",
    fontSize: 13,
    color: mobileColors.textPrimary
  },
  time: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.textSecondary,
    marginTop: 1
  },
  body: {
    ...mobileTypography.body,
    fontSize: 14,
    lineHeight: 20,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: mobileSpacing.md,
    marginTop: mobileSpacing.sm,
    paddingTop: mobileSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(47, 158, 68, 0.15)"
  },
  actionBtn: {
    paddingVertical: 2
  },
  actionLabel: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  actionLabelActive: {
    color: mobileColors.accent
  },
  reactionCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  reactionTx: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  }
});
