import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  levenshtein,
  normalizeLocalityName,
  pickFarmGeoSource,
  resolveDepartmentFromLocalityMemory,
  rollupChainMemory
} from "./geo-rollup.pure";

function loadGeo() {
  const p = path.join(__dirname, "data", "ci-departments.geo.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as {
    features: Array<{
      properties: { departmentCode: string };
      geometry: unknown;
    }>;
  };
}

function departmentAt(lat: number, lng: number): string | null {
  const fc = loadGeo();
  if (!fc) return null;
  const pt = turfPoint([lng, lat]);
  for (const f of fc.features) {
    try {
      if (booleanPointInPolygon(pt, f as never)) {
        return f.properties.departmentCode;
      }
    } catch {
      /* skip */
    }
  }
  return null;
}

describe("normalizeLocalityName", () => {
  it("normalise accents, casse et espaces", () => {
    expect(normalizeLocalityName("Bingerville")).toBe("bingerville");
    expect(normalizeLocalityName("BINGERVILLE")).toBe("bingerville");
    expect(normalizeLocalityName("  Bingerville  ")).toBe("bingerville");
    expect(normalizeLocalityName("Ferkessédougou")).toBe("ferkessedougou");
  });
});

describe("levenshtein / fuzzy locality", () => {
  const localities = [
    { nameNormalized: "bingerville", departmentCode: "CI-BG" },
    { nameNormalized: "bouake", departmentCode: "CI-BK" },
    { nameNormalized: "korhogo", departmentCode: "CI-KO" },
    { nameNormalized: "abidjan", departmentCode: "CI-AB" }
  ];

  it("correspondance exacte", () => {
    expect(resolveDepartmentFromLocalityMemory("Bingerville", localities)).toEqual(
      { departmentCode: "CI-BG", confidence: "exact" }
    );
  });

  it("correspondance floue (typo distance ≤ 2)", () => {
    // bingervile → bingerville (1 insert)
    expect(resolveDepartmentFromLocalityMemory("bingervile", localities)).toEqual(
      { departmentCode: "CI-BG", confidence: "fuzzy" }
    );
  });

  it("ambiguïté fuzzy → null", () => {
    const ambiguous = [
      { nameNormalized: "aboisso", departmentCode: "CI-DEP-A" },
      { nameNormalized: "aboissa", departmentCode: "CI-DEP-B" }
    ];
    // "aboisse" is distance 1 from both? aboisso=1 (o→e), aboissa=1 (a→e)
    expect(resolveDepartmentFromLocalityMemory("aboisse", ambiguous)).toBeNull();
  });
});

describe("pickFarmGeoSource priorité GPS", () => {
  it("préfère GPS quand les deux existent", () => {
    expect(
      pickFarmGeoSource({
        hasCoords: true,
        gpsDepartment: "CI-AB",
        localityDepartment: "CI-BK"
      })
    ).toEqual({ departmentCode: "CI-AB", source: "gps" });
  });

  it("fallback localité sans coords", () => {
    expect(
      pickFarmGeoSource({
        hasCoords: false,
        gpsDepartment: null,
        localityDepartment: "CI-BG"
      })
    ).toEqual({ departmentCode: "CI-BG", source: "locality" });
  });
});

describe("rollup département→région→district", () => {
  const regions = [
    {
      code: "CI-D-VB",
      name: "Vallée du Bandama",
      level: "district" as const,
      parentCode: null
    },
    {
      code: "CI-R-GB",
      name: "Gbêkê",
      level: "region" as const,
      parentCode: "CI-D-VB"
    },
    {
      code: "CI-BK",
      name: "Bouaké",
      level: "department" as const,
      parentCode: "CI-R-GB"
    }
  ];

  it("remonte la chaîne", () => {
    const chain = rollupChainMemory("CI-BK", regions);
    expect(chain.department?.name).toBe("Bouaké");
    expect(chain.region?.name).toBe("Gbêkê");
    expect(chain.district?.name).toBe("Vallée du Bandama");
  });
});

describe("point-dans-polygone (GeoJSON CI)", () => {
  const geo = loadGeo();
  const maybe = geo ? it : it.skip;

  maybe("Abidjan centre → département Abidjan", () => {
    const code = departmentAt(5.36, -4.0083);
    expect(code).toBeTruthy();
    expect(code === "CI-AB" || code?.includes("ABIDJAN") || code === "CI-AB").toBe(
      true
    );
    // code généré CI-AB
    expect(code).toBe("CI-AB");
  });

  maybe("Bouaké → CI-BK", () => {
    expect(departmentAt(7.69, -5.03)).toBe("CI-BK");
  });

  maybe("Korhogo → CI-KO", () => {
    expect(departmentAt(9.46, -5.63)).toBe("CI-KO");
  });
});

describe("levenshtein unit", () => {
  it("distance de base", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("bingerville", "bingervile")).toBe(1);
  });
});
