import { Prisma } from "@prisma/client";

const MIGRATION_NOTE_PREFIX = "Migré depuis lot";

/** Décrémente l'effectif d'une bande quand un sujet en sort (vente, mortalité, etc.). */
export async function decrementLivestockBatchHeadcount(
  tx: Prisma.TransactionClient,
  params: {
    batchId: string;
    farmId: string;
    decrementBy?: number;
    endedAt?: Date;
  }
): Promise<void> {
  const batch = await tx.livestockBatch.findFirst({
    where: { id: params.batchId, farmId: params.farmId }
  });
  if (!batch) {
    return;
  }

  const decrementBy = params.decrementBy ?? 1;
  const linkedActive = await tx.animal.count({
    where: {
      farmId: params.farmId,
      livestockBatchId: batch.id,
      status: "active"
    }
  });

  const newHead =
    linkedActive > 0
      ? Math.max(0, linkedActive - decrementBy)
      : Math.max(0, batch.headcount - decrementBy);
  const endedAt = params.endedAt ?? new Date();

  await tx.livestockBatch.update({
    where: { id: batch.id },
    data: {
      headcount: newHead,
      ...(newHead <= 0 ? { status: "closed" } : {})
    }
  });

  if (newHead <= 0) {
    await tx.penPlacement.updateMany({
      where: {
        batchId: batch.id,
        endedAt: null,
        pen: { barn: { farmId: params.farmId } }
      },
      data: { endedAt }
    });
  }
}

/** Resynchronise batch.headcount sur le nombre de sujets actifs liés. */
export async function syncLivestockBatchHeadcountFromMembers(
  tx: Prisma.TransactionClient,
  batchId: string,
  farmId: string
): Promise<void> {
  const activeCount = await tx.animal.count({
    where: { farmId, livestockBatchId: batchId, status: "active" }
  });
  if (activeCount <= 0) {
    return;
  }
  await tx.livestockBatch.update({
    where: { id: batchId },
    data: { headcount: activeCount, status: "active" }
  });
}

/**
 * Résout la bande impactée par une vente : livestockBatchId direct,
 * ou bande des sujets co-logés (vente d'un doublon fictif sans lien bande).
 */
export async function resolveBatchIdForAnimalExit(
  tx: Prisma.TransactionClient,
  params: {
    farmId: string;
    animalId: string;
    livestockBatchId: string | null;
    penIds: string[];
  }
): Promise<string | null> {
  if (params.livestockBatchId) {
    return params.livestockBatchId;
  }
  if (params.penIds.length === 0) {
    return null;
  }

  const mate = await tx.animal.findFirst({
    where: {
      farmId: params.farmId,
      status: "active",
      id: { not: params.animalId },
      livestockBatchId: { not: null },
      penPlacements: {
        some: { penId: { in: params.penIds }, endedAt: null }
      }
    },
    select: { livestockBatchId: true },
    orderBy: { createdAt: "asc" }
  });
  return mate?.livestockBatchId ?? null;
}

/** Archive les sujets fictifs créés par migration onboarding quand une bande confirmée existe déjà dans la loge. */
export async function repairOrphanMigrationDuplicateAnimals(
  tx: Prisma.TransactionClient,
  farmId: string
): Promise<number> {
  const orphans = await tx.animal.findMany({
    where: {
      farmId,
      status: "active",
      livestockBatchId: null,
      notes: { startsWith: MIGRATION_NOTE_PREFIX }
    },
    select: {
      id: true,
      notes: true,
      penPlacements: {
        where: { endedAt: null },
        select: { id: true, penId: true }
      }
    }
  });
  if (orphans.length === 0) {
    return 0;
  }

  const batchMemberPlacements = await tx.penPlacement.findMany({
    where: {
      endedAt: null,
      pen: { barn: { farmId } },
      animal: {
        status: "active",
        livestockBatchId: { not: null }
      }
    },
    select: { penId: true }
  });
  const pensWithConfirmedBatch = new Set(
    batchMemberPlacements.map((p) => p.penId)
  );

  let archived = 0;
  const now = new Date();
  for (const orphan of orphans) {
    const orphanPenIds = orphan.penPlacements.map((p) => p.penId);
    const overlapsBatchPen = orphanPenIds.some((penId) =>
      pensWithConfirmedBatch.has(penId)
    );
    if (!overlapsBatchPen) {
      continue;
    }

    await tx.animal.update({
      where: { id: orphan.id },
      data: {
        status: "transferred",
        statusChangedAt: now,
        notes: `${orphan.notes ?? MIGRATION_NOTE_PREFIX} · doublon migration archivé`
      }
    });
    await tx.penPlacement.updateMany({
      where: { animalId: orphan.id, endedAt: null },
      data: { endedAt: now }
    });
    archived += 1;
  }

  const batchIds = await tx.animal.findMany({
    where: { farmId, livestockBatchId: { not: null }, status: "active" },
    select: { livestockBatchId: true },
    distinct: ["livestockBatchId"]
  });
  for (const row of batchIds) {
    if (row.livestockBatchId) {
      await syncLivestockBatchHeadcountFromMembers(
        tx,
        row.livestockBatchId,
        farmId
      );
    }
  }

  return archived;
}
