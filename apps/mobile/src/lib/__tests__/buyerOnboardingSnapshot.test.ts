import { buyerProfileFromOnboarding } from "../buyerOnboardingSnapshot";
import { buyerProfileCompletionPercent } from "../buyerProfileCompletion";

describe("buyer onboarding completion", () => {
  it("atteint ≥ 80% avec type, catégories, volume, localisation, rayon et prix", () => {
    const profile = buyerProfileFromOnboarding({
      buyerType: "individual",
      preferredCategories: ["piglet", "butcher"],
      typicalVolume: "5-20",
      locationLabel: "Abidjan",
      homeLatitude: 5.36,
      homeLongitude: -4.0,
      searchRadiusKm: 25,
      priceRangeMin: 1000,
      priceRangeMax: 2500
    });
    expect(buyerProfileCompletionPercent(profile)).toBeGreaterThanOrEqual(80);
  });
});
