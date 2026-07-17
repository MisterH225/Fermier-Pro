import type { Expression } from "mapbox-gl";
import type { HealthMapGranularity, HealthMapZone } from "@/lib/api";

export type DepartmentMapStats = {
  departmentCode: string;
  departmentName?: string;
  activeCasesCount: number;
  farmsAffectedCount?: number;
  dominantDiagnoses?: Array<{ name: string; count: number }>;
  masked?: boolean;
};

export type ChoroplethIntensityMetric = "activeCasesCount" | "farmsAffectedCount";

export type HealthMapRenderMode = "choropleth" | "points";

export type DepartmentFeatureState = {
  hasData: boolean;
  masked: boolean;
  activeCases: number;
  farmsAffected: number;
  hover: boolean;
  selected: boolean;
};

const CHOROPLETH_COLOR_STOPS: Array<[number, string]> = [
  [0, "#FFF1F2"],
  [1, "#FECACA"],
  [3, "#FCA5A5"],
  [8, "#F87171"],
  [20, "#EF4444"],
  [50, "#DC2626"],
  [100, "#B91C1C"]
];

const NO_DATA_FILL = "#E5E7EB";
const MASKED_FILL = "#D1D5DB";
const ZERO_CASES_FILL = "#FFF1F2";

export { MASKED_FILL, NO_DATA_FILL };

export function extractDepartmentCode(zoneId: string): string {
  return zoneId.startsWith("department:") ? zoneId.slice("department:".length) : zoneId;
}

export function departmentSelectionKey(departmentCode: string): string {
  return `department:${departmentCode}`;
}

export function zoneMatchesDepartment(
  zoneId: string,
  selected: string | null
): boolean {
  if (!selected) return false;
  if (zoneId === selected) return true;
  if (selected.startsWith("department:")) {
    return zoneId === selected;
  }
  return zoneId === departmentSelectionKey(selected);
}

export function deriveDepartmentStatsFromZones(
  zones: HealthMapZone[]
): DepartmentMapStats[] {
  return zones
    .filter((z) => z.level === "department")
    .map((z) => ({
      departmentCode: extractDepartmentCode(z.id),
      departmentName: z.label,
      activeCasesCount: z.activeCases ?? 0,
      farmsAffectedCount: z.farmCount,
      dominantDiagnoses: z.topDiseases,
      masked: z.masked === true
    }));
}

export function resolveHealthMapMode(input: {
  mode?: HealthMapRenderMode;
  departmentStats?: DepartmentMapStats[];
  mapDataMode?: "aggregated";
  granularity?: HealthMapGranularity;
  points?: unknown[] | null;
}): HealthMapRenderMode {
  if (input.mode) return input.mode;
  if (input.departmentStats && input.departmentStats.length > 0) {
    return "choropleth";
  }
  if (input.mapDataMode === "aggregated" && input.granularity === "department") {
    return "choropleth";
  }
  return "points";
}

export function buildStatsByDepartment(
  stats: DepartmentMapStats[]
): Map<string, DepartmentMapStats> {
  const map = new Map<string, DepartmentMapStats>();
  for (const row of stats) {
    map.set(row.departmentCode, row);
  }
  return map;
}

export function intensityValue(
  stat: DepartmentMapStats | undefined,
  metric: ChoroplethIntensityMetric
): number {
  if (!stat || stat.masked) return 0;
  if (metric === "farmsAffectedCount") {
    return stat.farmsAffectedCount ?? 0;
  }
  return stat.activeCasesCount ?? 0;
}

export function buildDepartmentFeatureState(
  stat: DepartmentMapStats | undefined,
  _metric: ChoroplethIntensityMetric,
  options?: { hover?: boolean; selected?: boolean }
): DepartmentFeatureState {
  const masked = stat?.masked === true;
  const hasData = Boolean(stat);
  const activeCases = intensityValue(stat, "activeCasesCount");
  const farmsAffected = intensityValue(stat, "farmsAffectedCount");

  return {
    hasData,
    masked,
    activeCases: masked ? 0 : activeCases,
    farmsAffected: masked ? 0 : farmsAffected,
    hover: options?.hover === true,
    selected: options?.selected === true
  };
}

export function computeGeoJsonBounds(
  geojson: GeoJSON.FeatureCollection
): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visitCoords = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const part of coords) {
      visitCoords(part);
    }
  };

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "GeometryCollection") {
      for (const geom of feature.geometry.geometries) {
        if ("coordinates" in geom) {
          visitCoords(geom.coordinates);
        }
      }
      continue;
    }
    if ("coordinates" in feature.geometry) {
      visitCoords(feature.geometry.coordinates);
    }
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ];
}

export function buildColorScaleSteps(maxValue: number): Array<{
  label: string;
  color: string;
  min: number;
  max: number | null;
}> {
  const max = Math.max(1, maxValue);
  const thresholds = CHOROPLETH_COLOR_STOPS.map(([value]) => value).filter(
    (value) => value <= max || value === 0
  );

  const uniqueThresholds = [...new Set([0, ...thresholds, max])].sort(
    (a, b) => a - b
  );

  const steps: Array<{
    label: string;
    color: string;
    min: number;
    max: number | null;
  }> = [];

  for (let i = 0; i < uniqueThresholds.length; i += 1) {
    const min = uniqueThresholds[i];
    const next = uniqueThresholds[i + 1];
    const color =
      min === 0
        ? ZERO_CASES_FILL
        : (CHOROPLETH_COLOR_STOPS.find(([v]) => v === min)?.[1] ??
          CHOROPLETH_COLOR_STOPS[CHOROPLETH_COLOR_STOPS.length - 1][1]);
    steps.push({
      min,
      max: next != null ? next - 1 : null,
      label:
        next == null
          ? `≥ ${min}`
          : min === next - 1
            ? String(min)
            : `${min}–${next - 1}`,
      color
    });
  }

  return steps.slice(-6);
}

export function maxIntensityFromStats(
  stats: DepartmentMapStats[],
  metric: ChoroplethIntensityMetric
): number {
  return Math.max(
    0,
    ...stats
      .filter((row) => row.masked !== true)
      .map((row) => intensityValue(row, metric))
  );
}

export function buildChoroplethFillColorExpression(
  metric: ChoroplethIntensityMetric
): Expression {
  const metricKey =
    metric === "farmsAffectedCount" ? "farmsAffected" : "activeCases";

  const steps: Expression = ["step", ["feature-state", metricKey]];
  for (const [value, color] of CHOROPLETH_COLOR_STOPS) {
    if (value === 0) {
      steps.push(color);
      continue;
    }
    steps.push(value, color);
  }

  return [
    "case",
    ["boolean", ["feature-state", "masked"], false],
    MASKED_FILL,
    ["!", ["boolean", ["feature-state", "hasData"], false]],
    NO_DATA_FILL,
    steps
  ];
}

export function buildChoroplethFillOpacityExpression(): Expression {
  return [
    "case",
    ["boolean", ["feature-state", "masked"], false],
    0.45,
    ["!", ["boolean", ["feature-state", "hasData"], false]],
    0.42,
    ["==", ["feature-state", "activeCases"], 0],
    0.55,
    0.78
  ];
}

export function buildChoroplethLineWidthExpression(): Expression {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    2.8,
    ["boolean", ["feature-state", "hover"], false],
    2,
    0.75
  ];
}

export function buildChoroplethLineColorExpression(): Expression {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    "#5B21B6",
    ["boolean", ["feature-state", "hover"], false],
    "#1D4ED8",
    "#374151"
  ];
}

export const CHOROPLETH_LAYER_IDS = {
  fill: "health-dept-fill",
  line: "health-dept-borders",
  points: "health-circles",
  zoneCircles: "health-zone-circles"
} as const;

export const CHOROPLETH_SOURCE_ID = "ci-departments";

export const CI_DEPARTMENTS_GEOJSON_URL = "/geo/ci-departments.geo.json";
