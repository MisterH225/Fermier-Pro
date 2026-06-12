import { Prisma } from "@prisma/client";
import { allocateTagCodesInTransaction } from "../livestock/allocate-tag-codes";

export type CreateLitterPigletsParams = {
  farmId: string;
  userId: string;
  batchId: string;
  speciesId: string;
  breedId: string | null;
  count: number;
  birthDate: Date;
  averageBirthWeightKg?: number | null;
  penId: string;
  sowId: string;
  sireId: string | null;
  transferSowWithLitter: boolean;
  placementNote?: string;
};

export type CreateLitterPigletsResult = {
  animalIds: string[];
  pensToRecalculate: string[];
};

/** Crée des porcelets individuels (tags Dem) et les place dans la loge de portée. */
export async function createLitterPigletsInTransaction(
  tx: Prisma.TransactionClient,
  params: CreateLitterPigletsParams
): Promise<CreateLitterPigletsResult> {
  if (params.count <= 0) {
    return { animalIds: [], pensToRecalculate: [] };
  }

  const tags = await allocateTagCodesInTransaction(
    tx,
    params.farmId,
    "Dem",
    params.count
  );
  const entryWeight =
    params.averageBirthWeightKg != null
      ? new Prisma.Decimal(params.averageBirthWeightKg)
      : null;
  const placementNote = params.placementNote ?? "Mise bas — portée";
  const animalIds: string[] = [];
  const pensToRecalculate = new Set<string>([params.penId]);

  let sowPreviousPenId: string | null = null;
  if (params.transferSowWithLitter) {
    const sowPlacement = await tx.penPlacement.findFirst({
      where: {
        animalId: params.sowId,
        endedAt: null,
        pen: { barn: { farmId: params.farmId } }
      },
      orderBy: { startedAt: "desc" },
      select: { penId: true }
    });
    sowPreviousPenId = sowPlacement?.penId ?? null;
    if (sowPreviousPenId && sowPreviousPenId !== params.penId) {
      pensToRecalculate.add(sowPreviousPenId);
    }
  }

  for (const tagCode of tags) {
    const animal = await tx.animal.create({
      data: {
        farmId: params.farmId,
        speciesId: params.speciesId,
        breedId: params.breedId,
        sex: "unknown",
        status: "active",
        tagCode,
        productionCategory: "starter",
        birthDate: params.birthDate,
        entryDate: params.birthDate,
        origin: "farm_born",
        damId: params.sowId,
        sireId: params.sireId,
        livestockBatchId: params.batchId,
        entryWeightKg: entryWeight
      }
    });
    await tx.penPlacement.create({
      data: {
        penId: params.penId,
        animalId: animal.id,
        createdByUserId: params.userId,
        note: placementNote
      }
    });
    animalIds.push(animal.id);
  }

  if (params.transferSowWithLitter) {
    await tx.penPlacement.updateMany({
      where: {
        animalId: params.sowId,
        endedAt: null,
        pen: { barn: { farmId: params.farmId } }
      },
      data: { endedAt: new Date() }
    });
    await tx.penPlacement.create({
      data: {
        penId: params.penId,
        animalId: params.sowId,
        createdByUserId: params.userId,
        note: "Mise bas — avec la portée"
      }
    });
  }

  return {
    animalIds,
    pensToRecalculate: [...pensToRecalculate]
  };
}
