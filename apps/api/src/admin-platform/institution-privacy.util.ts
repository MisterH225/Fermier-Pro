import type { HealthMapGranularity } from "./health-map-geo.helper";

const NOMINATIVE_FIELD_KEYS = new Set([
  "farmId",
  "farmName",
  "address",
  "latitude",
  "longitude"
]);

export type LowCellMaskable = {
  farmCount: number;
  [key: string]: unknown;
};

export type MaskedLowCell = {
  departmentCode: string;
  farmCount: number;
  masked: true;
};

export type PrivacyRow<T extends LowCellMaskable> =
  | MaskedLowCell
  | (Omit<T, keyof LowCellMaskable> & { farmCount: number; masked?: false });

/**
 * Masque les mailles sous le seuil k-anonymat (défaut : 5 fermes).
 * Les lignes masquées ne contiennent aucune valeur chiffrée métier.
 */
export function suppressLowCells<T extends LowCellMaskable & { departmentCode: string }>(
  rows: T[],
  minFarms = 5
): PrivacyRow<T>[] {
  return rows.map((row): PrivacyRow<T> => {
    if (row.farmCount < minFarms) {
      return {
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        masked: true
      };
    }
    const { farmCount, departmentCode, ...rest } = row;
    return {
      departmentCode,
      farmCount,
      ...rest
    } as PrivacyRow<T>;
  });
}

export type HealthMapZoneAggregated = {
  zoneId: string;
  label: string;
  level: HealthMapGranularity;
  farmsAffectedCount: number;
  casesCount: number;
  activeCasesCount: number;
  dominantDiagnoses: Array<{ name: string; count: number }>;
  centerLat: number | null;
  centerLng: number | null;
};

export type MaskedHealthMapZone = {
  zoneId: string;
  label: string;
  level: HealthMapGranularity;
  masked: true;
};

export type PrivacyHealthMapZone = HealthMapZoneAggregated | MaskedHealthMapZone;

/**
 * Masque les zones carte sanitaire sous le seuil k-anonymat (défaut : 5 fermes).
 * Les zones masquées ne contiennent aucun compteur métier exact.
 */
export function maskLowHealthMapZones(
  zones: HealthMapZoneAggregated[],
  minFarms = 5
): PrivacyHealthMapZone[] {
  return zones.map((zone): PrivacyHealthMapZone => {
    if (zone.farmsAffectedCount < minFarms) {
      return {
        zoneId: zone.zoneId,
        label: zone.label,
        level: zone.level,
        masked: true
      };
    }
    return zone;
  });
}

/** Garde de développement : interdit tout champ nominatif dans une réponse institution. */
export function assertNoNominativeFields(
  payload: unknown,
  path = "payload"
): void {
  if (payload == null || typeof payload !== "object") {
    return;
  }
  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i += 1) {
      assertNoNominativeFields(payload[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (NOMINATIVE_FIELD_KEYS.has(key)) {
      throw new Error(
        `Champ nominatif interdit dans une réponse institution : ${path}.${key}`
      );
    }
    if (value != null && typeof value === "object") {
      assertNoNominativeFields(value, `${path}.${key}`);
    }
  }
}
