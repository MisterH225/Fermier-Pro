import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FeedPostDto } from "../../lib/api/community-feed";
import { ProfileBadge } from "../feed/ProfileBadge";
import { ModerationWarningBanner } from "../feed/ModerationWarningBanner";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { FeedAvatar } from "./FeedAvatar";
import { FeedCommentInputBar } from "./FeedCommentInputBar";
import { FeedCommentThread } from "./FeedCommentThread";
import { FeedLikesRow } from "./FeedLikesRow";
import { formatFeedTime, resolveAuthorDisplayName } from "./feedDisplayUtils";
import { merchantColors } from "../../theme/merchantTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

const POST_TYPE_LABELS: Record<string, string> = {
  question: "Question",
  tip: "Astuce",
  observation: "Observation",
  alert: "Alerte",
  success: "Réussite",
  medical_tip: "Conseil vétérinaire",
  technical_tip: "Conseil technique"
};

function postTypeLabel(type: string | null | undefined): string {
  if (type && type in POST_TYPE_LABELS) {
    return POST_TYPE_LABELS[type]!;
  }
  return "Publication";
}

type Props = {
  post: FeedPostDto;
  canComment: boolean;
  onComment: (postId: string, body: string, parentCommentId?: string) => Promise<void>;
  onLikePost: (postId: string) => Promise<void>;
  onLikeComment: (commentId: string) => Promise<void>;
};

export function FeedPostCard({
  post,
  canComment,
  onComment,
  onLikePost,
  onLikeComment
}: Props) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [commentModWarning, setCommentModWarning] = useState<string | null>(null);

  const displayName = resolveAuthorDisplayName(post);
  const time = formatFeedTime(post.createdAt);

  const handleSendComment = () => {
    if (!comment.trim() || sending) {
      return;
    }
    setSending(true);
    void onComment(post.id, comment.trim())
      .then(() => {
        setComment("");
        setCommentModWarning(null);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : t("feed.commentBlocked", "Commentaire bloqué par la modération.");
        setCommentModWarning(message);
        Alert.alert(t("moderation.blockedTitle", "Message bloqué"), message);
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <View style={[styles.card, post.isVetHighlight && styles.vetHighlight]}>
      <View style={styles.header}>
        <FeedAvatar
          displayName={post.isAnonymous ? null : post.authorDisplayName}
          profileType={post.authorProfileType}
          anonymous={post.isAnonymous}
          size="lg"
          imageUrl={post.authorAvatarUrl}
          isOnline={post.isAnonymous ? undefined : post.authorIsOnline}
        />
        <View style={styles.headerBody}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName}>{displayName}</Text>
            <ProfileBadge profileType={post.authorProfileType} anonymous={post.isAnonymous} />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.postType}>{postTypeLabel(post.postType)}</Text>
            {time ? <Text style={styles.time}> · {time}</Text> : null}
          </View>
        </View>
      </View>

      <Text style={styles.postBody}>{post.body}</Text>

      {post.medicalDisclaimer ? (
        <Text style={styles.disclaimer}>{post.medicalDisclaimer}</Text>
      ) : null}
      {post.postType === "alert" ? (
        <Text style={styles.conditionalHint}>
          Cette alerte est partagée à titre informatif — consultez un professionnel si besoin.
        </Text>
      ) : null}

      <View style={styles.likeRow}>
        <Pressable onPress={() => void onLikePost(post.id)} style={styles.likeBtn}>
          <Ionicons
            name={post.likedByMe ? "heart" : "heart-outline"}
            size={20}
            color={post.likedByMe ? mobileColors.accent : mobileColors.textSecondary}
          />
          {post.likeCount > 0 ? (
            <Text style={[styles.likeCount, post.likedByMe && styles.likeCountActive]}>
              {post.likeCount}
            </Text>
          ) : null}
        </Pressable>
      </View>

      <FeedLikesRow
        likeCount={post.likeCount}
        recentLikers={post.recentLikers ?? []}
      />

      <FeedCommentThread
        comments={post.comments ?? []}
        postId={post.id}
        canComment={canComment}
        onComment={onComment}
        onLike={onLikeComment}
      />

      {canComment ? (
        <FeedCommentInputBar
          value={comment}
          onChangeText={(value) => {
            setComment(value);
            setCommentModWarning(null);
          }}
          onSend={handleSendComment}
          sending={sending}
          placeholder={t("feed.commentPlaceholder", "Commenter…")}
        />
      ) : null}
      {commentModWarning ? (
        <ModerationWarningBanner message={commentModWarning} severity="high" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  vetHighlight: {
    borderColor: uiNamedColors.c4A90D9,
    borderWidth: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm
  },
  headerBody: {
    flex: 1,
    minWidth: 0
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: mobileSpacing.xs
  },
  authorName: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },
  postType: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  time: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  postBody: {
    ...mobileTypography.body,
    marginTop: mobileSpacing.sm
  },
  disclaimer: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic",
    marginTop: mobileSpacing.sm
  },
  conditionalHint: {
    ...mobileTypography.meta,
    color: merchantColors.amberText,
    marginTop: mobileSpacing.xs
  },
  likeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs,
    paddingVertical: 4
  },
  likeCount: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  likeCountActive: {
    color: mobileColors.accent
  }
});
