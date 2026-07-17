/**
 * Fonctions pures testables sans Nest/Prisma (normalisation, Levenshtein, rollup mémoire).
 */
import { levenshtein } from "./levenshtein";
import { normalizeLocalityName } from "./normalize-locality-name";

export type MemoryAdminRegion = {
  code: string;
  name: string;
  level: "district" | "region" | "department";
  parentCode: string | null;
};

export type MemoryLocality = {
  nameNormalized: string;
  departmentCode: string;
};

export const FUZZY_MAX_DISTANCE = 2;

export function resolveDepartmentFromLocalityMemory(
  name: string,
  localities: MemoryLocality[]
): { departmentCode: string; confidence: "exact" | "fuzzy" } | null {
  const key = normalizeLocalityName(name);
  if (!key) return null;

  const exactCodes = [
    ...new Set(
      localities
        .filter((l) => l.nameNormalized === key)
        .map((l) => l.departmentCode)
    )
  ];
  if (exactCodes.length === 1) {
    return { departmentCode: exactCodes[0], confidence: "exact" };
  }
  if (exactCodes.length > 1) return null;

  const scored: Array<{ departmentCode: string; dist: number }> = [];
  for (const row of localities) {
    const dist = levenshtein(key, row.nameNormalized);
    if (dist <= FUZZY_MAX_DISTANCE) {
      scored.push({ departmentCode: row.departmentCode, dist });
    }
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.dist - b.dist);
  const minDist = scored[0].dist;
  const top = scored.filter((s) => s.dist === minDist);
  const depts = [...new Set(top.map((t) => t.departmentCode))];
  if (depts.length !== 1) return null;
  return { departmentCode: depts[0], confidence: "fuzzy" };
}

export function rollupChainMemory(
  departmentCode: string,
  regions: MemoryAdminRegion[]
): {
  department: MemoryAdminRegion | null;
  region: MemoryAdminRegion | null;
  district: MemoryAdminRegion | null;
} {
  const byCode = new Map(regions.map((r) => [r.code, r]));
  const department = byCode.get(departmentCode) ?? null;
  if (!department || department.level !== "department") {
    return { department: null, region: null, district: null };
  }
  const region = department.parentCode
    ? (byCode.get(department.parentCode) ?? null)
    : null;
  const district =
    region?.parentCode != null ? (byCode.get(region.parentCode) ?? null) : null;
  return {
    department,
    region: region?.level === "region" ? region : null,
    district: district?.level === "district" ? district : null
  };
}

export function pickFarmGeoSource(input: {
  hasCoords: boolean;
  gpsDepartment: string | null;
  localityDepartment: string | null;
}): { departmentCode: string | null; source: "gps" | "locality" | "unresolved" } {
  if (input.hasCoords && input.gpsDepartment) {
    return { departmentCode: input.gpsDepartment, source: "gps" };
  }
  if (input.localityDepartment) {
    return { departmentCode: input.localityDepartment, source: "locality" };
  }
  return { departmentCode: null, source: "unresolved" };
}

export { normalizeLocalityName, levenshtein };
