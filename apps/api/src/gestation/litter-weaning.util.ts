import type { PrismaService } from "../prisma/prisma.service";

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
