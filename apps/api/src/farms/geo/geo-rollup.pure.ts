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

/** Mots trop génériques à ignorer lors du découpage d’adresse. */
const LOCALITY_STOP_KEYS = new Set([
  "cote",
  "ivoire",
  "d ivoire",
  "cote d ivoire",
  "cote divoire",
  "senegal",
  "ci",
  "rue",
  "avenue",
  "boulevard",
  "bd",
  "quartier",
  "lot",
  "cite",
  "village",
  "commune",
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "et",
  "en",
  "sur",
  "pres"
]);

/**
 * Candidats texte pour rattacher une ferme à une localité / département CI.
 * Ordre : ville → secteur → segments d’adresse → mots significatifs
 * (ex. « Bonoua Yaou » → « Bonoua Yaou », « Bonoua », « Yaou »).
 */
export function collectLocalityCandidates(input: {
  locationCity?: string | null;
  locationSector?: string | null;
  address?: string | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const t = raw?.trim();
    if (!t || t.length < 2) return;
    // Ignore paires lat,lng collées dans le label GPS
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(t)) return;
    if (/^\d+$/.test(t)) return;
    const key = normalizeLocalityName(t);
    if (!key || seen.has(key)) return;
    if (LOCALITY_STOP_KEYS.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  push(input.locationCity);
  push(input.locationSector);
  if (input.address?.trim()) {
    for (const part of input.address.split(",")) {
      push(part);
      // Découpe les libellés type « Bonoua Yaou » / « Anyama yapokoi »
      for (const word of part.split(/[\s;/|+]+/)) {
        if (word.trim().length >= 4) push(word);
      }
    }
  }
  return out;
}

/**
 * Parmi plusieurs départements candidats pour une même localité,
 * préfère celui dont le nom admin = nom de localité (ex. Anyama → CI-DEP-ANYAMA).
 */
export function preferDepartmentForLocality(
  localityName: string,
  departmentCodes: string[],
  departments: Array<{ code: string; name: string }>
): string | null {
  const unique = [...new Set(departmentCodes)];
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0]!;
  const key = normalizeLocalityName(localityName);
  const byName = departments.filter(
    (d) => unique.includes(d.code) && normalizeLocalityName(d.name) === key
  );
  if (byName.length === 1) return byName[0]!.code;
  return null;
}

export { normalizeLocalityName, levenshtein };
