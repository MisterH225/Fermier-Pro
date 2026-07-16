/**
 * Exposition API de `pendingSubscription` (checkout Premium d'inscription).
 *
 * Une facture pending peut rester en base après un choix Free (audit / reprise).
 * On ne l'expose au client que tant qu'aucun tier n'a encore été choisi
 * (`subscriptionTier === null`), pour ne pas ré-enfermer l'onboarding.
 */
export function shouldExposePendingSubscription(
  subscriptionTier: string | null | undefined
): boolean {
  return subscriptionTier == null;
}
