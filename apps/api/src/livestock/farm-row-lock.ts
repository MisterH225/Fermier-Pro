import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";

/**
 * Verrouille la ferme pour la durée de la transaction (PostgreSQL `FOR UPDATE`).
 * Sérialise migrations legacy, allocation Eng/Dem/Trui/Ver, etc.
 */
export async function lockFarmRowForUpdate(
  tx: PrismaTypes.TransactionClient,
  farmId: string
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Farm" WHERE "id" = ${farmId} FOR UPDATE`
  );
}
