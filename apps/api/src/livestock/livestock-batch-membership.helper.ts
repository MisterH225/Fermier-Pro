import type { Prisma } from "@prisma/client";

/** Délie les sujets actifs orphelins (plus de loge) encore rattachés à la bande. */
export async function detachOrphanedBatchMembers(
  tx: Prisma.TransactionClient,
  farmId: string,
  batchId: string
): Promise<number> {
  const orphans = await tx.animal.findMany({
    where: {
      farmId,
      livestockBatchId: batchId,
      status: "active",
      penPlacements: { none: { endedAt: null } }
    },
    select: { id: true }
  });
  if (orphans.length === 0) {
    return 0;
  }
  await tx.animal.updateMany({
    where: { id: { in: orphans.map((o) => o.id) } },
    data: { livestockBatchId: null }
  });
  return orphans.length;
}

/**
 * Portées sevrées : les porcelets passés en démarrage/engraissement ne doivent plus
 * bloquer la suppression de la bande « Portée … » (headcount stocké à 0).
 */
export async function detachWeanedLitterGraduates(
  tx: Prisma.TransactionClient,
  farmId: string,
  batchId: string,
  asOf = new Date()
): Promise<number> {
  const litter = await tx.litter.findFirst({
    where: {
      farmId,
      starterBatchId: batchId,
      weaningDate: { lte: asOf }
    },
    select: { id: true }
  });
  if (!litter) {
    return 0;
  }

  const graduates = await tx.animal.findMany({
    where: {
      farmId,
      livestockBatchId: batchId,
      status: "active",
      productionCategory: { in: ["starter", "fattening"] }
    },
    select: { id: true }
  });
  if (graduates.length === 0) {
    return 0;
  }

  await tx.animal.updateMany({
    where: { id: { in: graduates.map((g) => g.id) } },
    data: { livestockBatchId: null }
  });
  return graduates.length;
}

export async function countActiveBatchMembers(
  tx: Prisma.TransactionClient,
  farmId: string,
  batchId: string
): Promise<number> {
  return tx.animal.count({
    where: { farmId, livestockBatchId: batchId, status: "active" }
  });
}

export async function prepareBatchForDeletion(
  tx: Prisma.TransactionClient,
  farmId: string,
  batchId: string
): Promise<number> {
  await detachOrphanedBatchMembers(tx, farmId, batchId);
  await detachWeanedLitterGraduates(tx, farmId, batchId);
  return countActiveBatchMembers(tx, farmId, batchId);
}
