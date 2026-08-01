import type { ImageSourcePropType } from "react-native";

/**
 * Photos catalogue bundlées (vraies images produit) — jamais d'initiales.
 * Clés = slug ASCII du canonicalName (aligné API `feedIngredientImageSlug`).
 */
const CATALOG: Record<string, ImageSourcePropType> = {
  "mais-jaune": require("../../assets/images/feed-ingredients/mais-jaune.jpg"),
  "son-de-riz": require("../../assets/images/feed-ingredients/son-de-riz.jpg"),
  "son-de-ble": require("../../assets/images/feed-ingredients/son-de-ble.jpg"),
  "cossettes-de-manioc": require("../../assets/images/feed-ingredients/cossettes-de-manioc.jpg"),
  melasse: require("../../assets/images/feed-ingredients/melasse.jpg"),
  "huile-de-palme": require("../../assets/images/feed-ingredients/huile-de-palme.jpg"),
  "son-de-riz-gras": require("../../assets/images/feed-ingredients/son-de-riz-gras.jpg"),
  "tourteau-de-soja": require("../../assets/images/feed-ingredients/tourteau-de-soja.jpg"),
  "tourteau-de-coton": require("../../assets/images/feed-ingredients/tourteau-de-coton.jpg"),
  "tourteau-de-palmiste": require("../../assets/images/feed-ingredients/tourteau-de-palmiste.jpg"),
  "tourteau-d-arachide": require("../../assets/images/feed-ingredients/tourteau-d-arachide.jpg"),
  "dreche-de-brasserie-sechee": require("../../assets/images/feed-ingredients/dreche-de-brasserie-sechee.jpg"),
  "feuilles-de-manioc-sechees": require("../../assets/images/feed-ingredients/feuilles-de-manioc-sechees.jpg"),
  "farine-de-poisson": require("../../assets/images/feed-ingredients/farine-de-poisson.jpg"),
  "farine-de-sang": require("../../assets/images/feed-ingredients/farine-de-sang.jpg"),
  "farine-de-viande-et-d-os": require("../../assets/images/feed-ingredients/farine-de-viande-et-d-os.jpg"),
  "coquilles-d-huitre": require("../../assets/images/feed-ingredients/coquilles-d-huitre.jpg"),
  "phosphate-bicalcique": require("../../assets/images/feed-ingredients/phosphate-bicalcique.jpg"),
  sel: require("../../assets/images/feed-ingredients/sel.jpg"),
  "complement-mineral-vitamine-cmv": require("../../assets/images/feed-ingredients/complement-mineral-vitamine-cmv.jpg"),
  lysine: require("../../assets/images/feed-ingredients/lysine.jpg"),
  methionine: require("../../assets/images/feed-ingredients/methionine.jpg")
};

const DEFAULT_IMAGE: ImageSourcePropType = require("../../assets/images/feed-ingredients/feed-default.jpg");

export function feedIngredientImageSlug(canonicalName: string): string {
  return canonicalName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Source locale pour un intrant (catalogue ou défaut générique). */
export function localFeedIngredientImage(
  canonicalName?: string | null
): ImageSourcePropType {
  if (!canonicalName?.trim()) return DEFAULT_IMAGE;
  return CATALOG[feedIngredientImageSlug(canonicalName)] ?? DEFAULT_IMAGE;
}

export function hasLocalFeedIngredientImage(
  canonicalName?: string | null
): boolean {
  if (!canonicalName?.trim()) return false;
  return Boolean(CATALOG[feedIngredientImageSlug(canonicalName)]);
}
