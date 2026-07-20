import type { VetProfileCompletionInput } from "./vetProfileCompletion";

/** Profil synthétique pour la jauge (même module que VetAccountScreen). */
export function vetProfileFromOnboarding(input: {
  bio: string;
  otherSpecialties: string[];
  interventionRadiusKm: number | null;
  profilePhotoUrl: string | null;
  availability?: boolean;
}): VetProfileCompletionInput {
  return {
    bio: input.bio.trim() || null,
    otherSpecialties: input.otherSpecialties,
    interventionRadiusKm: input.interventionRadiusKm,
    profilePhotoUrl: input.profilePhotoUrl,
    availability: input.availability ?? true
  };
}
