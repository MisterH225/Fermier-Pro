import type { PrismaService } from "../prisma/prisma.service";

/** Répare les portées effacées par la migration legacy (headcount 0 / inactive). */
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
      starterBatchId: true,
      bornAlive: true,
      gestation: {
        select: {
          sow: {
            select: {
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

  for (const litter of litters) {
    const batchId = litter.starterBatchId;
    if (!batchId) {
      continue;
    }

    const batch = await prisma.livestockBatch.findUnique({
      where: { id: batchId },
      select: { id: true, headcount: true, status: true, farmId: true }
    });
    if (!batch || batch.farmId !== farmId) {
      continue;
    }

    const needsHeadcountFix =
      batch.headcount !== litter.bornAlive || batch.status !== "active";
    if (needsHeadcountFix) {
      await prisma.livestockBatch.update({
        where: { id: batchId },
        data: {
          headcount: litter.bornAlive,
          status: "active",
          categoryKey: "sous_mere"
        }
      });
    }

    const activePlacement = await prisma.penPlacement.findFirst({
      where: { batchId, endedAt: null }
    });
    if (activePlacement) {
      continue;
    }

    const lastPlacement = await prisma.penPlacement.findFirst({
      where: { batchId },
      orderBy: { startedAt: "desc" },
      select: { penId: true, createdByUserId: true }
    });
    const sowPlacement =
      litter.gestation.sow.penPlacements[0] ?? null;
    const penId = lastPlacement?.penId ?? sowPlacement?.penId;
    const createdByUserId =
      lastPlacement?.createdByUserId ?? sowPlacement?.createdByUserId;
    if (!penId || !createdByUserId) {
      continue;
    }

    await prisma.penPlacement.create({
      data: {
        penId,
        batchId,
        createdByUserId,
        note: "Restauration portée — mise bas"
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
