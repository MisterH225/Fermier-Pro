import type { PlatformModuleDto } from "./api/config";
import { hasFarmScope } from "./menuVisibility";

/** True si le module plateforme `feed_composition` est actif (config client). */
export function isFeedCompositionModuleActive(
  platformModules: PlatformModuleDto[] | null | undefined
): boolean {
  return (
    platformModules?.some(
      (m) => m.moduleId === "feed_composition" && m.isActive
    ) ?? false
  );
}

/** True si le module plateforme `delivery` est actif (livraison autogérée moulin). */
export function isDeliveryModuleActive(
  platformModules: PlatformModuleDto[] | null | undefined
): boolean {
  return (
    platformModules?.some((m) => m.moduleId === "delivery" && m.isActive) ??
    false
  );
}

export type CanOrderFeedCompositionParams = {
  profileType?: string | null;
  effectiveScopes?: string[];
  /** Ferme en lecture seule (rétrogradation abonnement). */
  writeLocked?: boolean;
};

/**
 * Producteur avec `finance.write` sur la ferme peut commander une composition validée.
 * Refusé pour véto, technicien, autres profils, ou ferme verrouillée.
 */
export function canOrderFeedComposition({
  profileType,
  effectiveScopes,
  writeLocked
}: CanOrderFeedCompositionParams): boolean {
  if (writeLocked) {
    return false;
  }
  if (
    profileType === "veterinarian" ||
    profileType === "technician" ||
    profileType !== "producer"
  ) {
    return false;
  }
  return hasFarmScope(effectiveScopes, "finance.write");
}
