import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { displayInitials, likerPlaceholderColor } from "./feedDisplayUtils";

const MAX_VISIBLE = 5;

type Props = {
  likeCount: number;
  likedByMe: boolean;
  currentUserName?: string | null;
};

export function FeedLikesRow({ likeCount, likedByMe, currentUserName }: Props) {
  const { t } = useTranslation();

  if (likeCount <= 0) {
    return null;
  }

  const visibleCount = Math.min(likeCount, MAX_VISIBLE);
  const overflow = likeCount > MAX_VISIBLE ? likeCount - MAX_VISIBLE : 0;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t("feed.likes", "J'aime")}</Text>
      <View style={styles.avatars}>
        {Array.from({ length: visibleCount }, (_, i) => {
          const isMe = likedByMe && i === 0;
          const bg = isMe
            ? mobileColors.accent
            : likerPlaceholderColor(i);
          const initials = isMe
            ? displayInitials(currentUserName)
            : "•";

          return (
            <View
              key={i}
              style={[
                styles.avatar,
                { backgroundColor: bg, marginLeft: i > 0 ? -10 : 0, zIndex: MAX_VISIBLE - i }
              ]}
            >
              <Text style={styles.avatarTx}>{initials}</Text>
            </View>
          );
        })}
        {overflow > 0 ? (
          <View style={[styles.avatar, styles.overflow, { marginLeft: -10 }]}>
            <Text style={styles.overflowTx}>+{overflow}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs
  },
  label: {
    ...mobileTypography.cardTitle,
    fontSize: 15
  },
  avatars: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    color: mobileColors.onAccent,
    fontSize: 11,
    fontWeight: "700"
  },
  overflow: {
    backgroundColor: mobileColors.surfaceMuted,
    zIndex: 0
  },
  overflowTx: {
    ...mobileTypography.meta,
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.textSecondary
  }
});
