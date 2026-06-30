/** Entrée minimale pour compter l'occupation d'une loge (animaux + bandes). */
export type PlacementOccupancyInput = {
  animalId: string | null;
  animalStatus?: string | null;
  batch?: { headcount: number; status?: string | null } | null;
};

/** Sélection Prisma standard pour calculer l'occupation en têtes. */
export const activePlacementOccupancySelect = {
  animalId: true,
  animal: { select: { status: true } },
  batch: { select: { headcount: true, status: true } }
} as const;

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

/** Normalise une ligne Prisma vers {@link PlacementOccupancyInput}. */
export function toPlacementOccupancyInput(pl: {
  animalId: string | null;
  animal?: { status: string } | null;
  batch?: { headcount: number; status?: string | null } | null;
}): PlacementOccupancyInput {
  return {
    animalId: pl.animalId,
    animalStatus: pl.animal?.status ?? null,
    batch: pl.batch
      ? { headcount: pl.batch.headcount, status: pl.batch.status ?? null }
      : null
  };
}

/** Compte l'occupation à partir de lignes Prisma (include/select placements). */
export function countPlacementOccupancyFromRows(
  placements: Array<{
    animalId: string | null;
    animal?: { status: string } | null;
    batch?: { headcount: number; status?: string | null } | null;
  }>
): number {
  return countPlacementOccupancy(placements.map(toPlacementOccupancyInput));
}
