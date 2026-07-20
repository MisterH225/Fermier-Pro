import { vetProfileFromOnboarding } from "../vetOnboardingSnapshot";
import { vetProfileCompletionPercent } from "../vetProfileCompletion";

describe("vet onboarding completion", () => {
  it("atteint ≥ 80% avec bio, spécialités secondaires et rayon", () => {
    const profile = vetProfileFromOnboarding({
      bio: "Vétérinaire porcin expérimenté",
      otherSpecialties: ["bovin"],
      interventionRadiusKm: 50,
      profilePhotoUrl: null,
      availability: true
    });
    // 4/5 = 80% (photo optionnelle)
    expect(vetProfileCompletionPercent(profile)).toBeGreaterThanOrEqual(80);
  });
});
