import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { PenAllocationService } from "../housing/pen-allocation.service";
import { createLitterPigletsInTransaction } from "./litter-individuals.util";

/** IDs des bandes de portée encore en lactation (weaningDate future). */
export async function activeNursingLitterBatchIds(
  prisma: Pick<PrismaService, "litter">,
  farmId: string,
  asOf = new Date()
): Promise<Set<string>> {
  const nursing = await prisma.litter.findMany({
    where: {
      farmId,
      weaningDate: { gt: asOf },
      starterBatchId: { not: null }
    },
    select: { starterBatchId: true }
  });
  return new Set(
    nursing
      .map((l) => l.starterBatchId)
      .filter((id): id is string => Boolean(id))
  );
}

/** Répare les portées : matérialise les porcelets en sujets individuels si besoin. */
export async function repairLitterBatches(
  prisma: PrismaService,
  farmId: string
): Promise<void> {
  const litters = await prisma.litter.findMany({
    where: {
      farmId,
      starterBatchId: { not: null },
      bornAlive: { gt: 0 }
    },
    select: {
      bornAlive: true,
      recordedAt: true,
      averageBirthWeightKg: true,
      starterBatchId: true,
      gestation: {
        select: {
          sowId: true,
          boarId: true,
          sow: {
            select: {
              speciesId: true,
              breedId: true,
              penPlacements: {
                where: { endedAt: null },
                orderBy: { startedAt: "desc" },
                take: 1,
                select: { penId: true, createdByUserId: true }
              }
            }
          }
        }
      }
    }
  });

  const penAllocation = new PenAllocationService(prisma);
  const pensToRecalculate = new Set<string>();

  for (const litter of litters) {
    const batchId = litter.starterBatchId;
    if (!batchId) {
      continue;
    }

    const batch = await prisma.livestockBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        headcount: true,
        status: true,
        farmId: true,
        categoryKey: true
      }
    });
    if (!batch || batch.farmId !== farmId) {
      continue;
    }

    const existingCount = await prisma.animal.count({
      where: { livestockBatchId: batchId, status: "active" }
    });

    const batchPlacement = await prisma.penPlacement.findFirst({
      where: { batchId, endedAt: null },
      select: { id: true, penId: true, createdByUserId: true }
    });

    const sowPlacement = litter.gestation.sow.penPlacements[0] ?? null;
    const penId =
      batchPlacement?.penId ??
      (
        await prisma.penPlacement.findFirst({
          where: { batchId },
          orderBy: { startedAt: "desc" },
          select: { penId: true }
        })
      )?.penId ??
      sowPlacement?.penId;
    const userId =
      batchPlacement?.createdByUserId ??
      (
        await prisma.penPlacement.findFirst({
          where: { batchId },
          orderBy: { startedAt: "desc" },
          select: { createdByUserId: true }
        })
      )?.createdByUserId ??
      sowPlacement?.createdByUserId;

    const needsIndividuals =
      existingCount < litter.bornAlive || batchPlacement != null;
    const needsBatchMetaFix =
      batch.headcount !== 0 ||
      batch.status !== "active" ||
      batch.categoryKey !== "sous_mere";

    if (!needsIndividuals && !needsBatchMetaFix) {
      continue;
    }

    if (!penId || !userId) {
      if (needsBatchMetaFix) {
        await prisma.livestockBatch.update({
          where: { id: batchId },
          data: {
            headcount: 0,
            status: "active",
            categoryKey: "sous_mere"
          }
        });
      }
      continue;
    }

    const toCreate = Math.max(0, litter.bornAlive - existingCount);
    const birthDate = litter.recordedAt;
    const avgWeight =
      litter.averageBirthWeightKg != null
        ? Number(litter.averageBirthWeightKg)
        : null;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (batchPlacement) {
        await tx.penPlacement.update({
          where: { id: batchPlacement.id },
          data: { endedAt: new Date() }
        });
        pensToRecalculate.add(batchPlacement.penId);
      }

      await tx.livestockBatch.update({
        where: { id: batchId },
        data: {
          headcount: 0,
          status: "active",
          categoryKey: "sous_mere"
        }
      });

      if (toCreate > 0) {
        const placed = await createLitterPigletsInTransaction(tx, {
          farmId,
          userId,
          batchId,
          speciesId: litter.gestation.sow.speciesId,
          breedId: litter.gestation.sow.breedId,
          count: toCreate,
          birthDate,
          averageBirthWeightKg: avgWeight,
          penId,
          sowId: litter.gestation.sowId,
          sireId: litter.gestation.boarId,
          transferSowWithLitter: false,
          placementNote: "Restauration portée — sujets individuels"
        });
        for (const pid of placed.pensToRecalculate) {
          pensToRecalculate.add(pid);
        }
      }
    });
  }

  if (pensToRecalculate.size > 0) {
    await prisma.$transaction(async (tx) => {
      for (const pid of pensToRecalculate) {
        await penAllocation.recalculatePenCategory(tx, pid);
        await penAllocation.recalculatePenAverageWeight(tx, pid);
      }
    });
  }
}

/** Synchronise les catégories des bandes de portée (lactation ↔ démarrage au sevrage). */
export async function syncLitterBatchCategories(
  prisma: PrismaService,
  farmId: string
): Promise<void> {
  const now = new Date();
  const nursing = await prisma.litter.findMany({
    where: {
      farmId,
      weaningDate: { gt: now },
      starterBatchId: { not: null }
    },
    select: { starterBatchId: true }
  });
  const nursingBatchIds = [
    ...new Set(
      nursing
        .map((l) => l.starterBatchId)
        .filter((id): id is string => Boolean(id))
    )
  ];
  if (nursingBatchIds.length > 0) {
    await prisma.livestockBatch.updateMany({
      where: {
        id: { in: nursingBatchIds },
        OR: [{ categoryKey: "starter" }, { categoryKey: null }]
      },
      data: { categoryKey: "sous_mere" }
    });
  }

  const weaned = await prisma.litter.findMany({
    where: {
      farmId,
      weaningDate: { lte: now },
      starterBatchId: { not: null }
    },
    select: { starterBatchId: true }
  });
  const weanedBatchIds = [
    ...new Set(
      weaned
        .map((l) => l.starterBatchId)
        .filter((id): id is string => Boolean(id))
    )
  ];
  if (weanedBatchIds.length === 0) {
    return;
  }
  await prisma.livestockBatch.updateMany({
    where: {
      id: { in: weanedBatchIds },
      categoryKey: "sous_mere"
    },
    data: { categoryKey: "starter" }
  });
}

export async function maintainLitterBatches(
  prisma: PrismaService,
  farmId: string
): Promise<void> {
  await repairLitterBatches(prisma, farmId);
  await syncLitterBatchCategories(prisma, farmId);
}
