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
 * Effectif à une date : uniquement les sujets actifs en base.
 * Une bande est un regroupement logique (livestockBatchId) — pas un effectif parallèle.
 */
export function countCheptelHeadcountAt(
  animals: CheptelHeadcountAnimal[],
  _batches?: CheptelHeadcountBatch[],
  asOf?: Date
): number {
  void _batches;
  const ref = asOf ?? new Date();
  return animals.filter(
    (a) => a.status === "active" && new Date(a.createdAt) <= ref
  ).length;
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
