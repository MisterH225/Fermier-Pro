import type { ProfileType } from "@fermier/types";
import { Image, StyleSheet, Text, View } from "react-native";
import { mobileColors } from "../../theme/mobileTheme";
import { avatarColorForProfileType, displayInitials } from "./feedDisplayUtils";

type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { dim: number; font: number; dot: number }> = {
  sm: { dim: 28, font: 11, dot: 8 },
  md: { dim: 36, font: 13, dot: 10 },
  lg: { dim: 44, font: 15, dot: 12 }
};

type Props = {
  displayName: string | null;
  profileType: ProfileType;
  anonymous?: boolean;
  size?: Size;
  imageUrl?: string | null;
  /** Présence en ligne — affichée uniquement si défini (Phase B API). */
  isOnline?: boolean;
};

export function FeedAvatar({
  displayName,
  profileType,
  anonymous = false,
  size = "md",
  imageUrl,
  isOnline
}: Props) {
  const { dim, font, dot } = SIZE_MAP[size];
  const bg = anonymous ? mobileColors.textSecondary : avatarColorForProfileType(profileType);
  const initials = anonymous ? "?" : displayInitials(displayName);

  return (
    <View style={[styles.wrap, { width: dim, height: dim }]}>
      {imageUrl && !anonymous ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.avatar, { width: dim, height: dim, borderRadius: dim / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.placeholder,
            { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg }
          ]}
        >
          <Text style={[styles.initials, { fontSize: font }]}>{initials}</Text>
        </View>
      )}
      {isOnline !== undefined ? (
        <View
          style={[
            styles.presenceDot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: isOnline ? mobileColors.success : mobileColors.error
            }
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative"
  },
  avatar: {
    overflow: "hidden"
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center"
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
