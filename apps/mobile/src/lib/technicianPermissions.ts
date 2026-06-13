import { hasFarmScope } from "./menuVisibility";

export type TechQuickActionKey =
  | "stock"
  | "weight"
  | "vaccine"
  | "disease"
  | "mortality"
  | "feedIn";

export type TechFarmModuleKey = "loges" | "cheptel" | "sante" | "gestation";

/** Autorisation d’une action rapide dashboard technicien selon les scopes ferme. */
export function canTechQuickAction(
  scopes: string[] | undefined,
  key: TechQuickActionKey
): boolean {
  if (!scopes?.length) {
    return false;
  }
  switch (key) {
    case "stock":
      return hasFarmScope(scopes, ["livestock.read", "livestock.write"]);
    case "feedIn":
      return hasFarmScope(scopes, "livestock.write");
    case "weight":
      return hasFarmScope(scopes, "livestock.write");
    case "vaccine":
    case "disease":
    case "mortality":
      return hasFarmScope(scopes, "health.write");
    default:
      return false;
  }
}

/** Accès lecture au module ferme (onglet Ma ferme). */
export function canTechViewFarmModule(
  scopes: string[] | undefined,
  module: TechFarmModuleKey
): boolean {
  if (!scopes?.length) {
    return false;
  }
  switch (module) {
    case "loges":
      return hasFarmScope(scopes, ["housing.read", "livestock.read", "livestock.write"]);
    case "cheptel":
      return hasFarmScope(scopes, ["livestock.read", "livestock.write"]);
    case "sante":
      return hasFarmScope(scopes, ["health.read", "health.write"]);
    case "gestation":
      return hasFarmScope(scopes, ["livestock.read", "livestock.write"]);
    default:
      return false;
  }
}

/** Écriture sur le module (bouton d’action / saisie). */
export function canTechWriteFarmModule(
  scopes: string[] | undefined,
  module: TechFarmModuleKey
): boolean {
  if (!scopes?.length) {
    return false;
  }
  switch (module) {
    case "loges":
      return hasFarmScope(scopes, ["housing.write", "livestock.write"]);
    case "cheptel":
      return hasFarmScope(scopes, "livestock.write");
    case "sante":
      return hasFarmScope(scopes, "health.write");
    case "gestation":
      return hasFarmScope(scopes, "livestock.write");
    default:
      return false;
  }
}
