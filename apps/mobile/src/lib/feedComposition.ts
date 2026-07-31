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

export type FeedCompositionOrderActor = {
  /** Type de profil actif (`producer` | `veterinarian` | `technician` | …). */
  profileType: string | null | undefined;
  /** Scopes RBAC effectifs sur la ferme (`GET /farms/:id` → `effectiveScopes`). */
  effectiveScopes?: string[] | null;
  /** Projet verrouillé en lecture seule (limite d’abonnement). */
  writeLocked?: boolean;
};

/**
 * Bouton « Commander » sur une composition validée.
 *
 * Visible / actif UNIQUEMENT pour le producteur propriétaire ou un membre
 * autorisé du projet (`finance.write` ou `*` — engagement financier).
 * JAMAIS pour le vétérinaire, le technicien, ni un membre en lecture seule :
 * le véto valide la composition, il ne la commande pas.
 */
export function canOrderFeedComposition(
  actor: FeedCompositionOrderActor
): boolean {
  const type = actor.profileType;
  if (type === "veterinarian" || type === "technician") {
    return false;
  }
  if (type !== "producer") {
    return false;
  }
  if (actor.writeLocked) {
    return false;
  }
  return hasFarmScope(actor.effectiveScopes ?? undefined, "finance.write");
}
