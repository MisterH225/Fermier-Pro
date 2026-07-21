import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FeedCommentDto } from "../../lib/api/community-feed";
import { mobileColors, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { FeedCommentBubble } from "./FeedCommentBubble";

type Props = {
  comments: FeedCommentDto[];
  postId: string;
  canComment: boolean;
  onComment: (postId: string, body: string, parentCommentId?: string) => Promise<void>;
  onLike: (commentId: string) => Promise<void>;
};

export function FeedCommentThread({
  comments,
  postId,
  canComment,
  onComment,
  onLike
}: Props) {
  const { t } = useTranslation();

  if (!comments.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("feed.comments", "Commentaires")}</Text>
        <Text style={styles.sortLabel}>{t("feed.mostRecent", "Plus récents")}</Text>
      </View>
      {comments.map((c) => (
        <FeedCommentBubble
          key={c.id}
          comment={c}
          postId={postId}
          depth={0}
          canComment={canComment}
          onComment={onComment}
          onLike={onLike}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: mobileSpacing.sm
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.xs,
    paddingTop: mobileSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  title: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md
  },
  sortLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
