import { useState } from "react";
import { Image, type ImageSourcePropType } from "react-native";
import { localFeedIngredientImage } from "../../lib/feedIngredientImages";
import { merchantColors } from "../../theme/merchantTheme";

/** Marqueur API historique pour pictogramme sans photo réelle. */
export const FERMIER_ICON_PREFIX = "fermier-icon:";

export function parseFermierIconKey(url: string | null | undefined): string | null {
  if (!url?.startsWith(FERMIER_ICON_PREFIX)) return null;
  return url.slice(FERMIER_ICON_PREFIX.length).trim() || null;
}

export type IngredientVisual =
  | { kind: "remote"; uri: string; iconKey: string }
  | { kind: "local"; source: ImageSourcePropType; iconKey: string };

/**
 * Visuel d'intrant : URL HTTP réelle si dispo, sinon photo catalogue locale.
 * Plus jamais d'initiales / pictogrammes texte.
 */
export function resolveIngredientVisual(opts: {
  imageUrl?: string | null;
  iconKey?: string | null;
  category?: string | null;
  photoUrls?: string[] | null;
  canonicalName?: string | null;
}): IngredientVisual {
  const iconKey =
    opts.iconKey?.trim() ||
    opts.category?.trim() ||
    "byproduct";

  const fromPhotos = (opts.photoUrls ?? []).find(
    (u) =>
      typeof u === "string" &&
      u.length > 0 &&
      !u.startsWith(FERMIER_ICON_PREFIX)
  );
  if (fromPhotos) {
    return { kind: "remote", uri: fromPhotos, iconKey };
  }
  if (opts.imageUrl?.trim()) {
    return { kind: "remote", uri: opts.imageUrl.trim(), iconKey };
  }

  return {
    kind: "local",
    source: localFeedIngredientImage(opts.canonicalName),
    iconKey
  };
}

type Props = {
  imageUrl?: string | null;
  iconKey?: string | null;
  category?: string | null;
  photoUrls?: string[] | null;
  /** Nom canonique pour résoudre la photo catalogue locale. */
  canonicalName?: string | null;
  size?: number;
  testID?: string;
};

/**
 * Visuel d'intrant : toujours une vraie image (remote ou catalogue bundlé).
 * Si l'URL remote échoue → fallback photo locale catalogue.
 */
export function FeedIngredientIcon({
  imageUrl,
  iconKey,
  category,
  photoUrls,
  canonicalName,
  size = 40,
  testID
}: Props) {
  const visual = resolveIngredientVisual({
    imageUrl,
    iconKey,
    category,
    photoUrls,
    canonicalName
  });
  const [remoteFailed, setRemoteFailed] = useState(false);
  const radius = Math.max(8, Math.round(size * 0.22));
  const style = {
    width: size,
    height: size,
    borderRadius: radius,
    backgroundColor: merchantColors.primaryLight
  };
  const localSource = localFeedIngredientImage(canonicalName);
  const label = canonicalName ?? visual.iconKey;

  if (visual.kind === "remote" && !remoteFailed) {
    return (
      <Image
        testID={testID ?? "feed-ingredient-image"}
        source={{ uri: visual.uri }}
        style={style}
        accessibilityLabel={label}
        onError={() => setRemoteFailed(true)}
      />
    );
  }

  return (
    <Image
      testID={testID ?? "feed-ingredient-image"}
      source={visual.kind === "local" ? visual.source : localSource}
      style={style}
      accessibilityLabel={label}
    />
  );
}
