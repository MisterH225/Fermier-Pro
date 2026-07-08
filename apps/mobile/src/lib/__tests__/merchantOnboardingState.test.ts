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

  it("ne renvoie pas à créer boutique si abonnement déjà choisi", () => {
    expect(
      resolveMerchantOnboardingStep({
        ...base,
        subscriptionTier: "free",
        shopCount: 1
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

  it("étape abonnement si rien n'est configuré", () => {
    expect(resolveMerchantOnboardingStep(base)).toBe(0);
  });
});
