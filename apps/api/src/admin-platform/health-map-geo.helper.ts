/** Précision grille secteur (~110 m à l'équateur). */
export const SECTOR_GRID_DECIMALS = 3;

/** Précision grille ville (sans adresse structurée, ~1,1 km). */
export const CITY_GRID_DECIMALS = 1;

export type HealthMapGranularity = "country" | "city" | "sector";

export type FarmGeoParts = {
  country: string;
  city: string | null;
  sector: string | null;
  line1: string | null;
};

export type MapScopeBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type FarmLocationInput = {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const WEST_AFRICA_BOUNDS: MapScopeBounds = {
  minLat: 4,
  maxLat: 17.5,
  minLng: -17.8,
  maxLng: -2
};

const AFRICA_BOUNDS: MapScopeBounds = {
  minLat: -35,
  maxLat: 37,
  minLng: -18,
  maxLng: 52
};

function normalizeGeoToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseFarmAddress(address?: string | null): FarmGeoParts {
  if (!address?.trim()) {
    return { country: "Inconnu", city: null, sector: null, line1: null };
  }
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { country: "Inconnu", city: null, sector: null, line1: null };
  }
  if (parts.length === 1) {
    return {
      country: parts[0],
      city: parts[0],
      sector: null,
      line1: null
    };
  }
  const country = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  const sector = parts.length >= 3 ? parts[parts.length - 3] : null;
  const line1 = parts.length > 3 ? parts.slice(0, -3).join(", ") : null;
  return { country, city, sector, line1 };
}

export function gridKey(
  lat: number,
  lng: number,
  decimals: number
): string {
  return `${lat.toFixed(decimals)},${lng.toFixed(decimals)}`;
}

export function gridCenter(
  key: string
): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = key.split(",");
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function resolveFarmLocation(input: FarmLocationInput): {
  geo: FarmGeoParts;
  lat: number | null;
  lng: number | null;
  sectorGrid: string | null;
  cityGrid: string | null;
} {
  const geo = parseFarmAddress(input.address);
  const lat =
    input.latitude != null && Number.isFinite(Number(input.latitude))
      ? Number(input.latitude)
      : null;
  const lng =
    input.longitude != null && Number.isFinite(Number(input.longitude))
      ? Number(input.longitude)
      : null;
  return {
    geo,
    lat,
    lng,
    sectorGrid: lat != null && lng != null ? gridKey(lat, lng, SECTOR_GRID_DECIMALS) : null,
    cityGrid:
      lat != null && lng != null ? gridKey(lat, lng, CITY_GRID_DECIMALS) : null
  };
}

export type ZoneKeyParts = {
  id: string;
  label: string;
  level: HealthMapGranularity;
  parentLabel: string | null;
  centerLat: number | null;
  centerLng: number | null;
};

export function buildZoneKey(
  granularity: HealthMapGranularity,
  loc: ReturnType<typeof resolveFarmLocation>
): ZoneKeyParts {
  const { geo, lat, lng, sectorGrid, cityGrid } = loc;
  const countryToken = normalizeGeoToken(geo.country);
  const cityName = geo.city ?? (cityGrid ? `Zone ${cityGrid}` : "Ville inconnue");
  const cityToken = normalizeGeoToken(cityName);

  if (granularity === "country") {
    return {
      id: `country:${countryToken}`,
      label: geo.country,
      level: "country",
      parentLabel: null,
      centerLat: lat,
      centerLng: lng
    };
  }

  if (granularity === "city") {
    const id = `city:${countryToken}:${cityToken}`;
    const center = cityGrid ? gridCenter(cityGrid) : lat != null && lng != null ? { lat, lng } : null;
    return {
      id,
      label: cityName,
      level: "city",
      parentLabel: geo.country,
      centerLat: center?.lat ?? lat,
      centerLng: center?.lng ?? lng
    };
  }

  // sector — quartier / grille fine (intra-ville)
  const sectorLabel =
    geo.sector?.trim() ||
    (sectorGrid ? `Grille ${sectorGrid}` : geo.line1?.trim() || "Secteur");
  const sectorToken = sectorGrid
    ? `grid-${sectorGrid.replace(",", "_")}`
    : normalizeGeoToken(sectorLabel);
  const center = sectorGrid ? gridCenter(sectorGrid) : lat != null && lng != null ? { lat, lng } : null;
  const label =
    geo.sector?.trim() && geo.city
      ? `${geo.city} · ${geo.sector}`
      : geo.city
        ? `${geo.city} · ${sectorLabel}`
        : sectorLabel;

  return {
    id: `sector:${countryToken}:${cityToken}:${sectorToken}`,
    label,
    level: "sector",
    parentLabel: geo.city ? `${geo.city}, ${geo.country}` : geo.country,
    centerLat: center?.lat ?? lat,
    centerLng: center?.lng ?? lng
  };
}

export function scopeBoundsFor(
  mapGeographicScope: string,
  mapCountryCodes: string[] | null | undefined
): MapScopeBounds | string[] | null {
  switch (mapGeographicScope) {
    case "west_africa":
      return WEST_AFRICA_BOUNDS;
    case "africa":
      return AFRICA_BOUNDS;
    case "countries": {
      const codes = (mapCountryCodes ?? []).filter(Boolean);
      return codes.length > 0 ? codes.map((c) => c.toLowerCase()) : null;
    }
    case "world":
    default:
      return null;
  }
}

export function farmMatchesScope(
  loc: ReturnType<typeof resolveFarmLocation>,
  scope: MapScopeBounds | string[] | null
): boolean {
  if (!scope) {
    return true;
  }
  if (Array.isArray(scope)) {
    const countryNorm = normalizeGeoToken(loc.geo.country);
    return scope.some(
      (code) =>
        countryNorm.includes(code) ||
        code.includes(countryNorm) ||
        loc.geo.country.toLowerCase().includes(code)
    );
  }
  if (loc.lat == null || loc.lng == null) {
    return true;
  }
  return (
    loc.lat >= scope.minLat &&
    loc.lat <= scope.maxLat &&
    loc.lng >= scope.minLng &&
    loc.lng <= scope.maxLng
  );
}
