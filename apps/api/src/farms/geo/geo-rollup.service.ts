import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { GeoResolutionSource, Prisma } from "@prisma/client";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaService } from "../../prisma/prisma.service";
import { levenshtein } from "./levenshtein";
import { normalizeLocalityName } from "./normalize-locality-name";

export type LocalityMatchConfidence = "exact" | "fuzzy";

export type LocalityResolution = {
  departmentCode: string;
  confidence: LocalityMatchConfidence;
};

export type FarmGeoInput = {
  latitude?: number | Prisma.Decimal | null;
  longitude?: number | Prisma.Decimal | null;
  locationCity?: string | null;
  address?: string | null;
};

export type FarmGeoResolution = {
  departmentCode: string | null;
  source: GeoResolutionSource;
};

type DeptFeature = {
  type: "Feature";
  properties: { departmentCode: string; name?: string };
  // Polygon | MultiPolygon (GeoJSON)
  geometry: { type: string; coordinates: unknown };
};

type DeptCollection = {
  type: "FeatureCollection";
  features: DeptFeature[];
};

const FUZZY_MAX_DISTANCE = 2;
/** Rayon max (km) pour rattacher une ferme à la localité la plus proche. */
const NEAREST_LOCALITY_MAX_KM = 75;

function toNum(v: number | Prisma.Decimal | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function loadDepartmentsGeoJson(): DeptCollection | null {
  const candidates = [
    path.join(__dirname, "data", "ci-departments.geo.json"),
    path.join(
      process.cwd(),
      "src",
      "farms",
      "geo",
      "data",
      "ci-departments.geo.json"
    ),
    path.join(
      process.cwd(),
      "apps",
      "api",
      "src",
      "farms",
      "geo",
      "data",
      "ci-departments.geo.json"
    )
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8")) as DeptCollection;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

@Injectable()
export class GeoRollupService implements OnModuleInit {
  private readonly logger = new Logger(GeoRollupService.name);
  private departmentPolygons: DeptCollection | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.departmentPolygons = loadDepartmentsGeoJson();
    if (!this.departmentPolygons?.features?.length) {
      this.logger.warn(
        "ci-departments.geo.json introuvable ou vide — résolution GPS via localité la plus proche uniquement."
      );
    } else {
      this.logger.log(
        `GeoJSON départements chargé (${this.departmentPolygons.features.length} polygones). ` +
          "Note : couverture partielle (open data ADM3 filtrée) ; fallback localité si hors polygone."
      );
    }
  }

  /**
   * Point-dans-polygone sur le GeoJSON départemental.
   * Fallback : localité référentiel la plus proche (≤ NEAREST_LOCALITY_MAX_KM).
   */
  async resolveDepartmentFromPoint(
    lat: number,
    lng: number
  ): Promise<string | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const fromPoly = this.resolveDepartmentFromPolygon(lat, lng);
    if (fromPoly) return fromPoly;

    return this.resolveDepartmentFromNearestLocality(lat, lng);
  }

  resolveDepartmentFromPolygon(lat: number, lng: number): string | null {
    const fc = this.departmentPolygons;
    if (!fc?.features?.length) return null;
    const pt = turfPoint([lng, lat]);
    for (const feature of fc.features) {
      if (!feature?.geometry || !feature.properties?.departmentCode) continue;
      try {
        if (booleanPointInPolygon(pt, feature as never)) {
          return feature.properties.departmentCode;
        }
      } catch {
        /* geometry invalide — ignorer */
      }
    }
    return null;
  }

  async resolveDepartmentFromNearestLocality(
    lat: number,
    lng: number
  ): Promise<string | null> {
    const rows = await this.prisma.localityRef.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null }
      },
      select: {
        departmentCode: true,
        latitude: true,
        longitude: true
      }
    });
    let best: { code: string; km: number } | null = null;
    for (const row of rows) {
      const la = toNum(row.latitude);
      const lo = toNum(row.longitude);
      if (la == null || lo == null) continue;
      const km = haversineKm(lat, lng, la, lo);
      if (km > NEAREST_LOCALITY_MAX_KM) continue;
      if (!best || km < best.km) best = { code: row.departmentCode, km };
    }
    return best?.code ?? null;
  }

  /**
   * Matching localité : exact sur nameNormalized, sinon fuzzy Levenshtein ≤ 2.
   * Ambiguïté (plusieurs départements distincts à distance min) → null.
   */
  async resolveDepartmentFromLocality(
    name: string
  ): Promise<LocalityResolution | null> {
    const key = normalizeLocalityName(name);
    if (!key) return null;

    const exact = await this.prisma.localityRef.findMany({
      where: { nameNormalized: key },
      select: { departmentCode: true }
    });
    const exactCodes = [...new Set(exact.map((e) => e.departmentCode))];
    if (exactCodes.length === 1) {
      return { departmentCode: exactCodes[0], confidence: "exact" };
    }
    if (exactCodes.length > 1) return null;

    const all = await this.prisma.localityRef.findMany({
      select: { nameNormalized: true, departmentCode: true }
    });
    type Cand = { departmentCode: string; dist: number };
    const scored: Cand[] = [];
    for (const row of all) {
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

  /**
   * Priorité : coordonnées (source=gps) puis texte localité (source=locality).
   */
  async resolveFarmDepartment(farm: FarmGeoInput): Promise<FarmGeoResolution> {
    const lat = toNum(farm.latitude);
    const lng = toNum(farm.longitude);
    if (lat != null && lng != null) {
      const code = await this.resolveDepartmentFromPoint(lat, lng);
      if (code) return { departmentCode: code, source: "gps" };
    }

    const localityText =
      farm.locationCity?.trim() ||
      extractLocalityHint(farm.address) ||
      null;
    if (localityText) {
      const match = await this.resolveDepartmentFromLocality(localityText);
      if (match) {
        return { departmentCode: match.departmentCode, source: "locality" };
      }
    }

    return { departmentCode: null, source: "unresolved" };
  }

  async rollupToRegion(
    departmentCode: string
  ): Promise<{ code: string; name: string } | null> {
    const dep = await this.prisma.adminRegionRef.findUnique({
      where: { code: departmentCode }
    });
    if (!dep?.parentCode) return null;
    const region = await this.prisma.adminRegionRef.findUnique({
      where: { code: dep.parentCode }
    });
    if (!region || region.level !== "region") return null;
    return { code: region.code, name: region.name };
  }

  async rollupToDistrict(
    departmentCode: string
  ): Promise<{ code: string; name: string } | null> {
    const region = await this.rollupToRegion(departmentCode);
    if (!region) return null;
    const reg = await this.prisma.adminRegionRef.findUnique({
      where: { code: region.code }
    });
    if (!reg?.parentCode) return null;
    const district = await this.prisma.adminRegionRef.findUnique({
      where: { code: reg.parentCode }
    });
    if (!district || district.level !== "district") return null;
    return { code: district.code, name: district.name };
  }

  async rollupChain(departmentCode: string): Promise<{
    department: { code: string; name: string } | null;
    region: { code: string; name: string } | null;
    district: { code: string; name: string } | null;
  }> {
    const department = await this.prisma.adminRegionRef.findUnique({
      where: { code: departmentCode },
      select: { code: true, name: true, level: true }
    });
    if (!department || department.level !== "department") {
      return { department: null, region: null, district: null };
    }
    const region = await this.rollupToRegion(departmentCode);
    const district = await this.rollupToDistrict(departmentCode);
    return {
      department: { code: department.code, name: department.name },
      region,
      district
    };
  }
}

function extractLocalityHint(address: string | null | undefined): string | null {
  if (!address?.trim()) return null;
  // Prend le premier segment avant virgule (souvent la ville).
  const first = address.split(",")[0]?.trim();
  return first && first.length >= 2 ? first : null;
}
