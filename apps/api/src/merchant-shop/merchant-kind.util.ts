import { MerchantKind } from "@prisma/client";

/**
 * Helper réutilisable pour les branches spécifiques moulin (J1-C+).
 * Un commerçant `standard` qui passe en `mill` conserve toutes ses données
 * (boutiques, produits, commandes, abonnement) — seul le sous-type change.
 */
export function isMill(
  profile: { merchantKind: MerchantKind } | null | undefined
): boolean {
  return profile?.merchantKind === MerchantKind.mill;
}
