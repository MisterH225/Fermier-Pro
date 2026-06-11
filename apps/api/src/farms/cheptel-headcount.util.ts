/** Données minimales pour calculer l'effectif sans double-compter bandes et sujets. */
export type CheptelHeadcountAnimal = {
  status: string;
  createdAt: Date;
  livestockBatchId: string | null;
};

export type CheptelHeadcountBatch = {
  id: string;
  headcount: number;
  status: string;
  closedAt: Date | null;
  createdAt: Date;
};

function batchesActiveAt(
  batches: CheptelHeadcountBatch[],
  asOf: Date
): CheptelHeadcountBatch[] {
  return batches.filter(
    (b) =>
      new Date(b.createdAt) <= asOf &&
      (b.status === "active" ||
        (b.closedAt != null && new Date(b.closedAt) > asOf))
  );
}

/**
 * Effectif à une date : sujets hors bande + effectifs des bandes actives.
 * Les animaux rattachés à une bande ne sont pas recomptés individuellement.
 */
export function countCheptelHeadcountAt(
  animals: CheptelHeadcountAnimal[],
  batches: CheptelHeadcountBatch[],
  asOf: Date
): number {
  const activeAt = animals.filter(
    (a) => a.status === "active" && new Date(a.createdAt) <= asOf
  );
  const batchesAt = batchesActiveAt(batches, asOf);
  const batchIdsAt = new Set(batchesAt.map((b) => b.id));
  const batchCreatedAt = new Map(
    batches.map((b) => [b.id, new Date(b.createdAt)] as const)
  );

  const individual = activeAt.filter((a) => {
    if (!a.livestockBatchId) {
      return true;
    }
    if (!batchIdsAt.has(a.livestockBatchId)) {
      return true;
    }
    const created = batchCreatedAt.get(a.livestockBatchId);
    return created != null && created > asOf;
  }).length;

  const batchHead = batchesAt.reduce((s, b) => s + b.headcount, 0);
  return individual + batchHead;
}
