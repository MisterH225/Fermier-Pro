import type { AnimalProductionCategory, Prisma } from "@prisma/client";
import {
  allocateTagCodesInTransaction,
  type AnimalTagPrefix
} from "./allocate-tag-codes";

/** Réattribue des tags séquentiels (nouveau préfixe) à une liste d'animaux. */
export async function retagAnimalsInTransaction(
  tx: Prisma.TransactionClient,
  farmId: string,
  animalIds: string[],
  newPrefix: AnimalTagPrefix,
  productionCategory?: AnimalProductionCategory
): Promise<void> {
  if (animalIds.length === 0) {
    return;
  }
  const codes = await allocateTagCodesInTransaction(
    tx,
    farmId,
    newPrefix,
    animalIds.length
  );
  for (let i = 0; i < animalIds.length; i++) {
    await tx.animal.update({
      where: { id: animalIds[i] },
      data: {
        tagCode: codes[i],
        ...(productionCategory ? { productionCategory } : {})
      }
    });
  }
}

export function tagPrefixFromCode(
  tagCode: string | null | undefined
): string | null {
  const trimmed = tagCode?.trim() ?? "";
  const dash = trimmed.indexOf("-");
  if (dash <= 0) {
    return null;
  }
  return trimmed.slice(0, dash).toUpperCase();
}
