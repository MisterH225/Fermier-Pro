import {
  buildZoneKey,
  farmMatchesScope,
  formatDepartmentZoneLabel,
  mergeFarmGeoParts,
  parseFarmAddress,
  resolveFarmLocation,
  scopeBoundsFor
} from "./health-map-geo.helper";

describe("health-map-geo.helper", () => {
  it("parseFarmAddress extrait pays, ville et secteur", () => {
    expect(
      parseFarmAddress("Rue 12, Almadies, Dakar, Sénégal")
    ).toEqual({
      line1: "Rue 12",
      sector: "Almadies",
      city: "Dakar",
      country: "Sénégal"
    });
  });

  it("buildZoneKey sector combine ville et grille GPS", () => {
    const loc = resolveFarmLocation({
      address: "Almadies, Dakar, Sénégal",
      latitude: 14.6923,
      longitude: -17.447
    });
    const zone = buildZoneKey("sector", loc);
    expect(zone.level).toBe("sector");
    expect(zone.label).toContain("Dakar");
    expect(zone.label).toContain("Almadies");
    expect(zone.id).toContain("sector:");
  });

  it("farmMatchesScope filtre Afrique de l'Ouest par bbox", () => {
    const bounds = scopeBoundsFor("west_africa", null);
    const inside = resolveFarmLocation({
      address: "Dakar, Sénégal",
      latitude: 14.69,
      longitude: -17.44
    });
    const outside = resolveFarmLocation({
      address: "Paris, France",
      latitude: 48.85,
      longitude: 2.35
    });
    expect(farmMatchesScope(inside, bounds)).toBe(true);
    expect(farmMatchesScope(outside, bounds)).toBe(false);
  });

  it("mergeFarmGeoParts préfère les champs structurés", () => {
    const geo = mergeFarmGeoParts({
      address: "Rue 10, ancien libellé, Dakar, Sénégal",
      locationSector: "Almadies",
      locationCity: "Dakar",
      locationCountry: "Sénégal"
    });
    expect(geo).toEqual({
      line1: "Rue 10",
      sector: "Almadies",
      city: "Dakar",
      country: "Sénégal"
    });
  });

  it("buildZoneKey department utilise departmentCode et AdminRegionRef", () => {
    const loc = resolveFarmLocation({
      address: "Anyama, Abidjan, Côte d'Ivoire",
      latitude: 5.49,
      longitude: -4.05,
      departmentCode: "CI-DEP-ANYAMA"
    });
    const zone = buildZoneKey("department", loc, {
      code: "CI-DEP-ANYAMA",
      name: "Anyama",
      regionName: "Abidjan"
    });
    expect(zone).toMatchObject({
      id: "department:CI-DEP-ANYAMA",
      label: "Anyama (Abidjan)",
      level: "department",
      parentLabel: "Abidjan"
    });
  });

  it("formatDepartmentZoneLabel retombe sur le code si référentiel absent", () => {
    expect(formatDepartmentZoneLabel(null, "CI-DEP-TEST")).toBe("CI-DEP-TEST");
    expect(formatDepartmentZoneLabel(null, null)).toBe("Département inconnu");
  });
});
