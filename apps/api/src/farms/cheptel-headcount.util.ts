/** Données minimales pour calculer l'effectif cheptel. */
export type CheptelHeadcountAnimal = {
  status: string;
  createdAt: Date;
  livestockBatchId?: string | null;
};

/** Conservé pour compatibilité des signatures ; n'entre plus dans le calcul d'effectif. */
export type CheptelHeadcountBatch = {
  id: string;
  headcount: number;
  status: string;
  closedAt: Date | null;
  createdAt: Date;
};

/**
 * Effectif à une date : sujets actifs + bandes sans animaux individuels rattachés.
 * Une bande avec des membres actifs est comptée via ses animaux (pas en double).
 */
export function countCheptelHeadcountAt(
  animals: CheptelHeadcountAnimal[],
  batches?: CheptelHeadcountBatch[],
  asOf?: Date
): number {
  const ref = asOf ?? new Date();
  const activeAnimals = animals.filter(
    (a) => a.status === "active" && new Date(a.createdAt) <= ref
  );
  const animalCount = activeAnimals.length;
  if (!batches?.length) {
    return animalCount;
  }

  const batchIdsWithAnimals = new Set(
    activeAnimals
      .map((a) => a.livestockBatchId)
      .filter((id): id is string => Boolean(id))
  );

  const batchOnlyHeadcount = batches
    .filter(
      (b) =>
        b.status === "active" &&
        !b.closedAt &&
        new Date(b.createdAt) <= ref &&
        !batchIdsWithAnimals.has(b.id)
    )
    .reduce((sum, b) => sum + b.headcount, 0);

  return animalCount + batchOnlyHeadcount;
}

/** Nombre de sujets actifs rattachés à une bande (informationnel, pas un second effectif). */
export function countActiveAnimalsInBatch(
  animals: Pick<CheptelHeadcountAnimal, "status" | "livestockBatchId">[],
  batchId: string
): number {
  return animals.filter(
    (a) => a.status === "active" && a.livestockBatchId === batchId
  ).length;
}
