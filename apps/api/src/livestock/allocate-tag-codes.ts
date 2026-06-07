import type { Prisma } from "@prisma/client";
import { formatTagCode } from "./animal-tag.helper";
import type { AnimalTagPrefix } from "./animal-production-tags.service";

const PREFIX_TO_COUNTER: Record<
  AnimalTagPrefix,
  "lastTruiTagNumber" | "lastVerTagNumber" | "lastEngTagNumber" | "lastDemTagNumber"
> = {
  Trui: "lastTruiTagNumber",
  Ver: "lastVerTagNumber",
  Eng: "lastEngTagNumber",
  Dem: "lastDemTagNumber"
};

type FarmTagCounterClient = Pick<Prisma.TransactionClient, "farm">;

/** Aperçu sans consommer de numéros (lecture seule des compteurs ferme). */
export async function peekTagCodeRange(
  client: FarmTagCounterClient,
  farmId: string,
  prefix: AnimalTagPrefix,
  count: number
): Promise<{ firstTagCode: string; lastTagCode: string; count: number }> {
  if (count < 1) {
    throw new Error("count must be >= 1");
  }
  const farm = await client.farm.findUnique({
    where: { id: farmId },
    select: {
      lastTruiTagNumber: true,
      lastVerTagNumber: true,
      lastEngTagNumber: true,
      lastDemTagNumber: true
    }
  });
  if (!farm) {
    throw new Error("Farm not found");
  }
  const counterKey = PREFIX_TO_COUNTER[prefix];
  const current = farm[counterKey];
  const seqStart = current + 1;
  const seqEnd = current + count;
  return {
    firstTagCode: formatTagCode(prefix, seqStart),
    lastTagCode: formatTagCode(prefix, seqEnd),
    count
  };
}

/**
 * Allocation atomique de numéros de boucle (increment SQL) — safe en transaction
 * longue et sans `SELECT FOR UPDATE` (compatible pooler Supabase).
 */
export async function allocateTagCodesInTransaction(
  tx: Prisma.TransactionClient,
  farmId: string,
  prefix: AnimalTagPrefix,
  count: number
): Promise<string[]> {
  if (count <= 0) {
    return [];
  }
  const counterKey = PREFIX_TO_COUNTER[prefix];
  const updated = await tx.farm.update({
    where: { id: farmId },
    data: { [counterKey]: { increment: count } },
    select: {
      lastTruiTagNumber: true,
      lastVerTagNumber: true,
      lastEngTagNumber: true,
      lastDemTagNumber: true
    }
  });
  const seqEnd = updated[counterKey];
  const seqStart = seqEnd - count + 1;
  const codes: string[] = [];
  for (let seq = seqStart; seq <= seqEnd; seq += 1) {
    codes.push(formatTagCode(prefix, seq));
  }
  return codes;
}
