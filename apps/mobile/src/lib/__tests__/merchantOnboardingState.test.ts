import type { MerchantMeDto } from "../api/merchant";
import { resolveMerchantOnboardingStep } from "../merchantOnboardingState";

const base = {
  onboardingComplete: false,
  shopCount: 0,
  shops: [],
  activeProductCount: 0,
  subscriptionTier: null
} as Pick<
  MerchantMeDto,
  "onboardingComplete" | "shopCount" | "shops" | "activeProductCount" | "subscriptionTier"
>;

describe("resolveMerchantOnboardingStep", () => {
  it("termine si onboardingComplete", () => {
    expect(resolveMerchantOnboardingStep({ ...base, onboardingComplete: true })).toBe(
      "finished"
    );
  });

  it("reprend à l'étape produit si boutique existante sans produit actif", () => {
    expect(
      resolveMerchantOnboardingStep({
        ...base,
        subscriptionTier: "free",
        shopCount: 1,
        shops: [{ id: "s1" } as MerchantMeDto["shops"][number]]
      })
    ).toBe(2);
  });

  it("abonnement + boutique existante → étape produit (pas boutique)", () => {
    expect(
      resolveMerchantOnboardingStep({
        ...base,
        subscriptionTier: "premium",
        shopCount: 1,
        shops: [{ id: "s1" } as MerchantMeDto["shops"][number]],
        activeProductCount: 0
      })
    ).toBe(2);
  });

  it("étape boutique si abonnement sans boutique", () => {
    expect(
      resolveMerchantOnboardingStep({
        ...base,
        subscriptionTier: "free"
      })
    ).toBe(1);
  });

  it("premium sans boutique → étape boutique", () => {
    expect(
      resolveMerchantOnboardingStep({
        ...base,
        subscriptionTier: "premium",
        shopCount: 0
      })
    ).toBe(1);
  });

  it("étape abonnement si rien n'est configuré", () => {
    expect(resolveMerchantOnboardingStep(base)).toBe(0);
  });

  it("boutique + produit actif → finished (plus d'étape 3)", () => {
    expect(
      resolveMerchantOnboardingStep({
        ...base,
        subscriptionTier: "premium",
        shopCount: 1,
        activeProductCount: 1
      })
    ).toBe("finished");
  });
});
