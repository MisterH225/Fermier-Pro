import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FeedLikerDto } from "../../lib/api/community-feed";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { FeedLikerAvatar } from "./FeedLikerAvatar";

const MAX_VISIBLE = 5;

type Props = {
  likeCount: number;
  recentLikers: FeedLikerDto[];
};

export function FeedLikesRow({ likeCount, recentLikers }: Props) {
  const { t } = useTranslation();

  if (likeCount <= 0) {
    return null;
  }

  const visibleLikers = recentLikers.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, likeCount - visibleLikers.length);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t("feed.likes", "J'aime")}</Text>
      <View style={styles.avatars}>
        {visibleLikers.map((liker, i) => (
          <View
            key={`${liker.displayName ?? "liker"}-${i}`}
            style={[styles.avatarSlot, { marginLeft: i > 0 ? -10 : 0, zIndex: MAX_VISIBLE - i }]}
          >
            <FeedLikerAvatar liker={liker} index={i} />
          </View>
        ))}
        {overflow > 0 ? (
          <View style={[styles.overflow, { marginLeft: visibleLikers.length > 0 ? -10 : 0 }]}>
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
  avatarSlot: {},
  overflow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: 2,
    borderColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0
  },
  overflowTx: {
    ...mobileTypography.meta,
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.textSecondary
  }
});
