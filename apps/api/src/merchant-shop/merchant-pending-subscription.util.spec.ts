import { shouldExposePendingSubscription } from "./merchant-pending-subscription.util";

describe("shouldExposePendingSubscription", () => {
  it("expose la facture pending uniquement si aucun tier n'est choisi", () => {
    expect(shouldExposePendingSubscription(null)).toBe(true);
    expect(shouldExposePendingSubscription(undefined)).toBe(true);
  });

  it("masque la facture pending après choix Free (facture conservée en base)", () => {
    expect(shouldExposePendingSubscription("free")).toBe(false);
  });

  it("masque la facture pending quand Premium est actif", () => {
    expect(shouldExposePendingSubscription("premium")).toBe(false);
  });
});
