/**
 * Contrat produit : bouton « Commander » sur l’écran détail composition.
 * Le véto valide ; seul le producteur (ou membre autorisé) peut commander.
 */
import { canOrderFeedComposition } from "../../../lib/feedComposition";

/** Miroir de la condition d’affichage dans FeedCompositionDetailScreen. */
function showOrderButton(opts: {
  status: string;
  profileType: string;
  effectiveScopes?: string[];
  writeLocked?: boolean;
}): boolean {
  return (
    opts.status === "validated" &&
    canOrderFeedComposition({
      profileType: opts.profileType,
      effectiveScopes: opts.effectiveScopes,
      writeLocked: opts.writeLocked
    })
  );
}

describe("FeedCompositionDetail — bouton Commander (permissions)", () => {
  it("véto ne voit pas « Commander » sur une composition validée", () => {
    expect(
      showOrderButton({
        status: "validated",
        profileType: "veterinarian",
        effectiveScopes: ["health.write", "vet.write", "chat"]
      })
    ).toBe(false);
  });

  it("producteur propriétaire voit « Commander » sur une composition validée", () => {
    expect(
      showOrderButton({
        status: "validated",
        profileType: "producer",
        effectiveScopes: ["*"]
      })
    ).toBe(true);
  });

  it("technicien ne voit pas « Commander »", () => {
    expect(
      showOrderButton({
        status: "validated",
        profileType: "technician",
        effectiveScopes: ["livestock.write"]
      })
    ).toBe(false);
  });

  it("lecture seule ne voit pas « Commander »", () => {
    expect(
      showOrderButton({
        status: "validated",
        profileType: "producer",
        effectiveScopes: ["livestock.read", "finance.read"]
      })
    ).toBe(false);
  });

  it("composition non validée : pas de bouton même pour le producteur", () => {
    expect(
      showOrderButton({
        status: "vet_review",
        profileType: "producer",
        effectiveScopes: ["*"]
      })
    ).toBe(false);
  });
});
