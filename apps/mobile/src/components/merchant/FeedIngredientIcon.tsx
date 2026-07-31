import { Image, StyleSheet, Text, View } from "react-native";
import { merchantColors } from "../../theme/merchantTheme";
import { mobileFontSize, mobileRadius } from "../../theme/mobileTheme";

/** Marqueur API pour pictogramme sans photo réelle. */
export const FERMIER_ICON_PREFIX = "fermier-icon:";

/** Pictogrammes texte (pas d'emoji) — fallback catégorie. */
const ICON_GLYPH: Record<string, string> = {
  cereal: "Cé",
  plant_protein: "PV",
  animal_protein: "PA",
  byproduct: "SP",
  mineral: "Mi",
  additive: "Ad"
};

export function parseFermierIconKey(url: string | null | undefined): string | null {
  if (!url?.startsWith(FERMIER_ICON_PREFIX)) return null;
  return url.slice(FERMIER_ICON_PREFIX.length).trim() || null;
}

export function resolveIngredientVisual(opts: {
  imageUrl?: string | null;
  iconKey?: string | null;
  category?: string | null;
  photoUrls?: string[] | null;
}): { imageUrl: string | null; iconKey: string } {
  const fromPhotos = (opts.photoUrls ?? []).find(
    (u) => typeof u === "string" && u.length > 0
  );
  if (fromPhotos && !fromPhotos.startsWith(FERMIER_ICON_PREFIX)) {
    return { imageUrl: fromPhotos, iconKey: opts.iconKey || opts.category || "byproduct" };
  }
  if (opts.imageUrl?.trim()) {
    return {
      imageUrl: opts.imageUrl.trim(),
      iconKey: opts.iconKey || opts.category || "byproduct"
    };
  }
  const fromMarker = parseFermierIconKey(fromPhotos);
  const key =
    fromMarker ||
    opts.iconKey?.trim() ||
    opts.category?.trim() ||
    "byproduct";
  return { imageUrl: null, iconKey: key };
}

type Props = {
  imageUrl?: string | null;
  iconKey?: string | null;
  category?: string | null;
  photoUrls?: string[] | null;
  size?: number;
  testID?: string;
};

/**
 * Visuel d'intrant : photo réelle si dispo, sinon pictogramme de catégorie.
 */
export function FeedIngredientIcon({
  imageUrl,
  iconKey,
  category,
  photoUrls,
  size = 40,
  testID
}: Props) {
  const visual = resolveIngredientVisual({
    imageUrl,
    iconKey,
    category,
    photoUrls
  });
  const radius = Math.max(8, Math.round(size * 0.22));

  if (visual.imageUrl) {
    return (
      <Image
        testID={testID ?? "feed-ingredient-image"}
        source={{ uri: visual.imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: merchantColors.primaryLight
        }}
      />
    );
  }

  const glyph = ICON_GLYPH[visual.iconKey] ?? visual.iconKey.slice(0, 2).toUpperCase();

  return (
    <View
      testID={testID ?? "feed-ingredient-icon"}
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius
        }
      ]}
      accessibilityLabel={visual.iconKey}
    >
      <Text style={[styles.glyph, { fontSize: Math.max(11, size * 0.32) }]}>
        {glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: merchantColors.primaryLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: merchantColors.primary
  },
  glyph: {
    fontWeight: "800",
    color: merchantColors.primary,
    fontSize: mobileFontSize.sm
  }
});
