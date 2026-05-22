import type { PrismaClient } from "@prisma/client";

const TAG_PATTERN = /^([A-Z]{2,8})-(\d+)$/i;

export function parseTagSequence(tagCode: string): { prefix: string; num: number } | null {
  const m = TAG_PATTERN.exec(tagCode.trim());
  if (!m) {
    return null;
  }
  const num = Number.parseInt(m[2], 10);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return { prefix: m[1].toUpperCase(), num };
}

export function formatTagCode(prefix: string, sequence: number): string {
  return `${prefix.toUpperCase()}-${String(sequence).padStart(3, "0")}`;
}

/** Prochain identifiant terrain `PORC-001` pour une ferme (ignore les publicId). */
export async function nextAnimalTagCode(
  prisma: PrismaClient,
  farmId: string,
  prefix = "PORC"
): Promise<string> {
  const normalized = prefix.toUpperCase();
  const rows = await prisma.animal.findMany({
    where: { farmId },
    select: { tagCode: true }
  });
  let max = 0;
  for (const row of rows) {
    if (!row.tagCode?.trim()) {
      continue;
    }
    const parsed = parseTagSequence(row.tagCode);
    if (parsed && parsed.prefix === normalized) {
      max = Math.max(max, parsed.num);
    }
  }
  return formatTagCode(normalized, max + 1);
}
