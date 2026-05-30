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
