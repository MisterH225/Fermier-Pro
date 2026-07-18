import type { AdminRegionLevel, PrismaClient } from "@prisma/client";

export type AdminRegionRefSeed = {
  code: string;
  name: string;
  level: AdminRegionLevel;
  parentCode?: string | null;
};

/**
 * Upsert un arbre AdminRegionRef en respectant la FK parentCode
 * (district → region → department).
 */
export async function ensureAdminRegionRefs(
  prisma: PrismaClient,
  rows: AdminRegionRefSeed[]
): Promise<void> {
  const levelOrder: Record<AdminRegionLevel, number> = {
    district: 0,
    region: 1,
    department: 2
  };
  const sorted = [...rows].sort(
    (a, b) => levelOrder[a.level] - levelOrder[b.level]
  );
  for (const row of sorted) {
    await prisma.adminRegionRef.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        level: row.level,
        parentCode: row.parentCode ?? null
      },
      update: {
        name: row.name,
        level: row.level,
        parentCode: row.parentCode ?? null
      }
    });
  }
}

/** Arbre minimal Lagunes / Vallée du Bandama pour les e2e stats + carte. */
export const E2E_ADMIN_REGION_TREE: AdminRegionRefSeed[] = [
  {
    code: "CI-D-LG",
    name: "Lagunes",
    level: "district",
    parentCode: null
  },
  {
    code: "CI-D-VB",
    name: "Vallée du Bandama",
    level: "district",
    parentCode: null
  },
  {
    code: "CI-R-AB",
    name: "Abidjan",
    level: "region",
    parentCode: "CI-D-LG"
  },
  {
    code: "CI-R-LM",
    name: "La Mé",
    level: "region",
    parentCode: "CI-D-LG"
  },
  {
    code: "CI-R-GB",
    name: "Gbêkê",
    level: "region",
    parentCode: "CI-D-VB"
  },
  {
    code: "CI-AB",
    name: "Abidjan",
    level: "department",
    parentCode: "CI-R-AB"
  },
  {
    code: "CI-BK",
    name: "Bouaké",
    level: "department",
    parentCode: "CI-R-GB"
  },
  {
    code: "CI-DEP-ANYAMA",
    name: "Anyama",
    level: "department",
    parentCode: "CI-R-AB"
  },
  {
    code: "CI-DEP-ADZOPE",
    name: "Adzopé",
    level: "department",
    parentCode: "CI-R-LM"
  }
];
