import { Prisma } from "@prisma/client";

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
  const newHead = Math.max(0, batch.headcount - decrementBy);
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
