/** Entrée minimale pour compter l'occupation d'une loge (animaux + bandes). */
export type PlacementOccupancyInput = {
  animalId: string | null;
  animalStatus?: string | null;
  batch?: { headcount: number; status?: string | null } | null;
};

/** Compte les places occupées : 1 par animal actif, headcount par bande active. */
export function countPlacementOccupancy(
  placements: PlacementOccupancyInput[]
): number {
  let n = 0;
  for (const pl of placements) {
    if (pl.animalId) {
      if (pl.animalStatus == null || pl.animalStatus === "active") {
        n += 1;
      }
    } else if (pl.batch) {
      if (pl.batch.status == null || pl.batch.status === "active") {
        n += pl.batch.headcount;
      }
    }
  }
  return n;
}
