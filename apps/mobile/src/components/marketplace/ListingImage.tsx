import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { DefaultPigImage } from "../common/DefaultPigImage";
import { FeedIngredientIcon } from "../merchant/FeedIngredientIcon";
import { pickListingImageUrl } from "../../lib/resolveListingImage";
import { mobileColors, mobileRadius } from "../../theme/mobileTheme";

type Props = {
  photos?: unknown;
  animalPhotoUrl?: string | null;
  fallbackPhotoUrl?: string | null;
  animal?: { photoUrl?: string | null } | null;
  height?: number;
  borderRadius?: number | { topLeft?: number; topRight?: number };
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function ListingImage({
  photos,
  animalPhotoUrl,
  fallbackPhotoUrl,
  animal,
  height = 160,
  borderRadius = mobileRadius.md,
  style,
  imageStyle
}: Props) {
  const uri = useMemo(
    () =>
      pickListingImageUrl({
        photoUrls: photos,
        fallbackPhotoUrl: fallbackPhotoUrl ?? animalPhotoUrl,
        animal
      }),
    [photos, fallbackPhotoUrl, animalPhotoUrl, animal]
  );

  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(uri));

  useEffect(() => {
    setFailed(false);
    setLoading(Boolean(uri));
  }, [uri]);

  const radiusStyle =
    typeof borderRadius === "number"
      ? {
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius
        }
      : {
          borderTopLeftRadius: borderRadius.topLeft ?? 0,
          borderTopRightRadius: borderRadius.topRight ?? 0
        };

  const iconPhotos = Array.isArray(photos)
    ? photos.filter((u): u is string => typeof u === "string")
    : [];
  const hasIngredientIcon = iconPhotos.some((u) =>
    u.startsWith("fermier-icon:")
  );

  if ((!uri || failed) && hasIngredientIcon) {
    return (
      <View
        style={[
          styles.wrap,
          styles.iconWrap,
          { height },
          radiusStyle,
          style
        ]}
      >
        <FeedIngredientIcon
          photoUrls={iconPhotos}
          size={Math.min(72, height * 0.45)}
        />
      </View>
    );
  }

  if (!uri || failed) {
    return (
      <View style={[styles.wrap, { height }, radiusStyle, style]}>
        <DefaultPigImage height={height} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }, radiusStyle, style]}>
      <Image
        source={{ uri }}
        style={[styles.image, { height }, radiusStyle, imageStyle]}
        resizeMode="cover"
        onLoadStart={() => {
          setLoading(true);
          setFailed(false);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setFailed(true);
          setLoading(false);
        }}
      />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={mobileColors.accent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    backgroundColor: mobileColors.surfaceMuted,
    overflow: "hidden"
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  image: {
    width: "100%"
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)"
  }
});
