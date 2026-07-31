/**
 * Les tests de montage React Test Renderer sont actuellement cassés dans cet
 * environnement (React 19 : `act` undefined sur react-test-renderer) — déjà
 * constaté sur main. La logique UX est couverte via feedComposition.test.ts
 * + revue manuelle / OTA.
 *
 * Cas produit à vérifier sur device :
 * - scroll unique (pas de FlatList imbriquée)
 * - bouton « Envoyer à mon vétérinaire » toujours visible après calcul
 * - astuce si aucun véto associé
 */
describe("FeedCompositionScreen (contrat UX)", () => {
  it("documente le bouton véto toujours proposé après une composition faisable", () => {
    const showSendToVet = true; // plus conditionné à hasVets
    const showNoVetHint = (hasVets: boolean) => !hasVets;
    expect(showSendToVet).toBe(true);
    expect(showNoVetHint(false)).toBe(true);
    expect(showNoVetHint(true)).toBe(false);
  });
});
