import { Image, StyleSheet, Text, View } from "react-native";
import type { FeedLikerDto } from "../../lib/api/community-feed";
import { mobileColors } from "../../theme/mobileTheme";
import { displayInitials, likerPlaceholderColor } from "./feedDisplayUtils";

const DOT_SIZE = 8;

type Props = {
  liker: FeedLikerDto;
  index: number;
  size?: number;
};

export function FeedLikerAvatar({ liker, index, size = 32 }: Props) {
  const bg = likerPlaceholderColor(index);
  const initials = displayInitials(liker.displayName);
  const radius = size / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {liker.avatarUrl ? (
        <Image
          source={{ uri: liker.avatarUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { width: size, height: size, borderRadius: radius, backgroundColor: bg }
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
        </View>
      )}
      <View
        style={[
          styles.presenceDot,
          {
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: liker.isOnline ? mobileColors.success : mobileColors.error
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative"
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: mobileColors.background
  },
  initials: {
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  presenceDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    borderWidth: 2,
    borderColor: mobileColors.background
  }
});
