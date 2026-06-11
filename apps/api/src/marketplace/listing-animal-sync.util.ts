import { ListingMarketCategory } from "@prisma/client";

export function parseListingAnimalIds(listing: {
  animalId: string | null;
  animalIds: unknown;
}): string[] {
  const fromJson = Array.isArray(listing.animalIds)
    ? listing.animalIds.filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    : [];
  if (listing.animalId && !fromJson.includes(listing.animalId)) {
    return [listing.animalId, ...fromJson];
  }
  return fromJson;
}

export function isIndividualListing(animalIds: string[]): boolean {
  return animalIds.length === 1;
}

export function isLotListing(animalIds: string[]): boolean {
  return animalIds.length >= 2;
}

/** Charcutier : au moins un animal cheptel lié. */
export function assertCharcutierAnimalLinked(
  category: ListingMarketCategory | null | undefined,
  animalIds: string[]
): void {
  if (category !== ListingMarketCategory.butcher) {
    return;
  }
  if (animalIds.length < 1) {
    throw new Error(
      "Une annonce charcutier doit être liée à au moins un animal du cheptel."
    );
  }
}

/** Poids estimé pour pricing lot (kg). */
export function estimateAnimalWeightKg(animal: {
  soldWeightKg: { toNumber(): number } | null;
  entryWeightKg: { toNumber(): number } | null;
  weights?: { weightKg: { toNumber(): number } }[];
}): number {
  if (animal.soldWeightKg != null) {
    const w = animal.soldWeightKg.toNumber();
    if (Number.isFinite(w) && w > 0) {
      return w;
    }
  }
  const latest = animal.weights?.[0];
  if (latest) {
    const w = latest.weightKg.toNumber();
    if (Number.isFinite(w) && w > 0) {
      return w;
    }
  }
  if (animal.entryWeightKg != null) {
    const w = animal.entryWeightKg.toNumber();
    if (Number.isFinite(w) && w > 0) {
      return w;
    }
  }
  return 80;
}
