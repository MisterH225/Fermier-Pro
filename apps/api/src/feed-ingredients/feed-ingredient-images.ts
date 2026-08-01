/**
 * URLs publiques du catalogue photos intrants (hébergées dans le monorepo,
 * servies via jsDelivr / GitHub après merge sur main).
 *
 * Les mêmes fichiers sont bundlés côté mobile
 * (`apps/mobile/assets/images/feed-ingredients/`) pour affichage offline.
 */

export const FEED_INGREDIENT_IMAGE_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/MisterH225/Fermier-Pro@main/apps/mobile/assets/images/feed-ingredients";

export function feedIngredientImageSlug(canonicalName: string): string {
  return canonicalName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function feedIngredientCatalogImageUrl(canonicalName: string): string {
  return `${FEED_INGREDIENT_IMAGE_CDN_BASE}/${feedIngredientImageSlug(canonicalName)}.jpg`;
}

export const FEED_INGREDIENT_DEFAULT_IMAGE_URL = `${FEED_INGREDIENT_IMAGE_CDN_BASE}/feed-default.jpg`;
