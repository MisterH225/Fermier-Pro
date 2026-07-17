"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { HealthMapDto, HealthMapGranularity, HealthMapZone } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HealthMapChoroplethLegend } from "./HealthMapChoroplethLegend";
import {
  buildChoroplethFillColorExpression,
  buildChoroplethFillOpacityExpression,
  buildChoroplethLineColorExpression,
  buildChoroplethLineWidthExpression,
  buildDepartmentFeatureState,
  buildStatsByDepartment,
  CHOROPLETH_LAYER_IDS,
  CHOROPLETH_SOURCE_ID,
  CI_DEPARTMENTS_GEOJSON_URL,
  computeGeoJsonBounds,
  deriveDepartmentStatsFromZones,
  extractDepartmentCode,
  maxIntensityFromStats,
  resolveHealthMapMode,
  type ChoroplethIntensityMetric,
  type DepartmentMapStats,
  type HealthMapRenderMode
} from "./health-map-choropleth";

type Props = {
  points?: HealthMapDto["points"];
  zones: HealthMapZone[];
  selectedZoneId: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  className?: string;
  mode?: HealthMapRenderMode;
  mapDataMode?: HealthMapDto["mode"];
  granularity?: HealthMapGranularity;
  departmentStats?: DepartmentMapStats[];
  intensityMetric?: ChoroplethIntensityMetric;
};

function severityColor(severity: string | null): string {
  switch (severity?.toLowerCase()) {
    case "critical":
    case "severe":
    case "élevée":
    case "elevee":
      return "#B91C1C";
    case "moderate":
    case "modérée":
    case "moderee":
      return "#EA580C";
    case "mild":
    case "légère":
    case "legere":
      return "#F59E0B";
    default:
      return "#E53935";
  }
}

function zoneRadius(activeCases: number, max: number): number {
  if (max <= 0) return 12;
  const ratio = activeCases / max;
  return 14 + Math.round(ratio * 28);
}

function formatDiagnosesList(
  diagnoses: Array<{ name: string; count: number }> | undefined,
  unknownLabel: string
): string {
  if (!diagnoses?.length) return "";
  return diagnoses
    .map((d) => `${d.name} (${d.count})`)
    .join("<br/>");
}

export function HealthMapbox({
  points,
  zones,
  selectedZoneId,
  onZoneSelect,
  className,
  mode: modeProp,
  mapDataMode,
  granularity,
  departmentStats: departmentStatsProp,
  intensityMetric = "activeCasesCount"
}: Props) {
  const t = useTranslations("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const geoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const boundsFittedRef = useRef(false);

  const zoneClickRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);
  const pointClickRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);
  const deptClickRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);
  const deptMoveRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);
  const deptLeaveRef = useRef<(() => void) | null>(null);
  const hoveredDeptRef = useRef<string | null>(null);

  const [geoReady, setGeoReady] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();

  const renderMode = useMemo(
    () =>
      resolveHealthMapMode({
        mode: modeProp,
        departmentStats: departmentStatsProp,
        mapDataMode,
        granularity,
        points
      }),
    [modeProp, departmentStatsProp, mapDataMode, granularity, points]
  );

  const departmentStats = useMemo(() => {
    if (departmentStatsProp?.length) return departmentStatsProp;
    if (renderMode === "choropleth") {
      return deriveDepartmentStatsFromZones(zones);
    }
    return [];
  }, [departmentStatsProp, renderMode, zones]);

  const statsByDepartment = useMemo(
    () => buildStatsByDepartment(departmentStats),
    [departmentStats]
  );

  const maxZoneActive = useMemo(
    () => Math.max(0, ...zones.map((z) => z.activeCases ?? 0)),
    [zones]
  );

  const maxChoroplethIntensity = useMemo(
    () => maxIntensityFromStats(departmentStats, intensityMetric),
    [departmentStats, intensityMetric]
  );

  const visiblePoints = useMemo(() => {
    const list = points ?? [];
    if (renderMode !== "points") return [];
    return selectedZoneId
      ? list.filter((p) => p.zoneId === selectedZoneId)
      : list;
  }, [points, selectedZoneId, renderMode]);

  const selectedDepartmentCode = useMemo(() => {
    if (!selectedZoneId) return null;
    if (selectedZoneId.startsWith("department:")) {
      return extractDepartmentCode(selectedZoneId);
    }
    return selectedZoneId;
  }, [selectedZoneId]);

  useEffect(() => {
    if (renderMode !== "choropleth") return;
    let cancelled = false;
    fetch(CI_DEPARTMENTS_GEOJSON_URL)
      .then((res) => res.json())
      .then((data: GeoJSON.FeatureCollection) => {
        if (!cancelled) {
          geoJsonRef.current = data;
          setGeoReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setGeoReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [renderMode]);

  useEffect(() => {
    if (!containerRef.current || !token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-5.5, 7.5],
      zoom: 5.5
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      boundsFittedRef.current = false;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;

    const unknownLabel = t("unknownDiagnosis");

    const detachPointsLayers = () => {
      if (zoneClickRef.current) {
        map.off("click", CHOROPLETH_LAYER_IDS.zoneCircles, zoneClickRef.current);
        zoneClickRef.current = null;
      }
      if (pointClickRef.current) {
        map.off("click", CHOROPLETH_LAYER_IDS.points, pointClickRef.current);
        pointClickRef.current = null;
      }
      if (map.getLayer(CHOROPLETH_LAYER_IDS.zoneCircles)) {
        map.removeLayer(CHOROPLETH_LAYER_IDS.zoneCircles);
      }
      if (map.getLayer(CHOROPLETH_LAYER_IDS.points)) {
        map.removeLayer(CHOROPLETH_LAYER_IDS.points);
      }
      if (map.getSource("health-zones")) {
        map.removeSource("health-zones");
      }
      if (map.getSource("health-points")) {
        map.removeSource("health-points");
      }
    };

    const detachChoroplethLayers = () => {
      if (deptClickRef.current) {
        map.off("click", CHOROPLETH_LAYER_IDS.fill, deptClickRef.current);
        deptClickRef.current = null;
      }
      if (deptMoveRef.current) {
        map.off("mousemove", CHOROPLETH_LAYER_IDS.fill, deptMoveRef.current);
        deptMoveRef.current = null;
      }
      if (deptLeaveRef.current) {
        map.off("mouseleave", CHOROPLETH_LAYER_IDS.fill, deptLeaveRef.current);
        deptLeaveRef.current = null;
      }
      map.getCanvas().style.cursor = "";
      if (hoveredDeptRef.current) {
        try {
          map.removeFeatureState({
            source: CHOROPLETH_SOURCE_ID,
            id: hoveredDeptRef.current
          });
        } catch {
          /* source may already be removed */
        }
        hoveredDeptRef.current = null;
      }
      if (map.getLayer(CHOROPLETH_LAYER_IDS.line)) {
        map.removeLayer(CHOROPLETH_LAYER_IDS.line);
      }
      if (map.getLayer(CHOROPLETH_LAYER_IDS.fill)) {
        map.removeLayer(CHOROPLETH_LAYER_IDS.fill);
      }
      if (map.getSource(CHOROPLETH_SOURCE_ID)) {
        map.removeSource(CHOROPLETH_SOURCE_ID);
      }
    };

    const applyDepartmentFeatureStates = () => {
      if (!map.getSource(CHOROPLETH_SOURCE_ID) || !geoJsonRef.current) return;

      for (const feature of geoJsonRef.current.features) {
        const departmentCode = String(
          feature.properties?.departmentCode ?? feature.id ?? ""
        );
        if (!departmentCode) continue;
        const stat = statsByDepartment.get(departmentCode);
        const selected =
          selectedDepartmentCode != null &&
          departmentCode === selectedDepartmentCode;
        const hover = hoveredDeptRef.current === departmentCode;
        map.setFeatureState(
          { source: CHOROPLETH_SOURCE_ID, id: departmentCode },
          buildDepartmentFeatureState(stat, intensityMetric, {
            hover,
            selected
          })
        );
      }
    };

    const renderChoropleth = () => {
      detachPointsLayers();
      const geojson = geoJsonRef.current;
      if (!geojson) return;

      const existing = map.getSource(CHOROPLETH_SOURCE_ID);
      if (!existing) {
        map.addSource(CHOROPLETH_SOURCE_ID, {
          type: "geojson",
          data: geojson,
          promoteId: "departmentCode"
        });
      } else if ("setData" in existing) {
        (existing as mapboxgl.GeoJSONSource).setData(geojson);
      }

      if (!map.getLayer(CHOROPLETH_LAYER_IDS.fill)) {
        map.addLayer({
          id: CHOROPLETH_LAYER_IDS.fill,
          type: "fill",
          source: CHOROPLETH_SOURCE_ID,
          paint: {
            "fill-color": buildChoroplethFillColorExpression(intensityMetric),
            "fill-opacity": buildChoroplethFillOpacityExpression()
          }
        });
      }

      if (!map.getLayer(CHOROPLETH_LAYER_IDS.line)) {
        map.addLayer({
          id: CHOROPLETH_LAYER_IDS.line,
          type: "line",
          source: CHOROPLETH_SOURCE_ID,
          paint: {
            "line-color": buildChoroplethLineColorExpression(),
            "line-width": buildChoroplethLineWidthExpression()
          }
        });
      }

      applyDepartmentFeatureStates();

      if (!boundsFittedRef.current) {
        const bounds = computeGeoJsonBounds(geojson);
        if (bounds) {
          map.fitBounds(bounds, { padding: 36, duration: 0 });
          boundsFittedRef.current = true;
        }
      }

      if (deptClickRef.current) {
        map.off("click", CHOROPLETH_LAYER_IDS.fill, deptClickRef.current);
      }
      if (deptMoveRef.current) {
        map.off("mousemove", CHOROPLETH_LAYER_IDS.fill, deptMoveRef.current);
      }
      if (deptLeaveRef.current) {
        map.off("mouseleave", CHOROPLETH_LAYER_IDS.fill, deptLeaveRef.current);
      }

      const onDeptMove = (e: mapboxgl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        const departmentCode = String(feature?.properties?.departmentCode ?? "");
        if (!departmentCode || hoveredDeptRef.current === departmentCode) return;

        if (hoveredDeptRef.current) {
          const prevStat = statsByDepartment.get(hoveredDeptRef.current);
          map.setFeatureState(
            { source: CHOROPLETH_SOURCE_ID, id: hoveredDeptRef.current },
            buildDepartmentFeatureState(prevStat, intensityMetric, {
              selected:
                selectedDepartmentCode === hoveredDeptRef.current
            })
          );
        }

        hoveredDeptRef.current = departmentCode;
        const stat = statsByDepartment.get(departmentCode);
        map.setFeatureState(
          { source: CHOROPLETH_SOURCE_ID, id: departmentCode },
          buildDepartmentFeatureState(stat, intensityMetric, {
            hover: true,
            selected: selectedDepartmentCode === departmentCode
          })
        );
      };

      const onDeptLeave = () => {
        map.getCanvas().style.cursor = "";
        if (!hoveredDeptRef.current) return;
        const code = hoveredDeptRef.current;
        hoveredDeptRef.current = null;
        const stat = statsByDepartment.get(code);
        map.setFeatureState(
          { source: CHOROPLETH_SOURCE_ID, id: code },
          buildDepartmentFeatureState(stat, intensityMetric, {
            selected: selectedDepartmentCode === code
          })
        );
      };

      const onDeptClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const departmentCode = String(feature.properties?.departmentCode ?? "");
        if (!departmentCode) return;

        const nextSelected =
          selectedDepartmentCode === departmentCode ? null : departmentCode;
        onZoneSelect?.(nextSelected);

        const stat = statsByDepartment.get(departmentCode);
        const departmentName =
          stat?.departmentName ??
          String(feature.properties?.name ?? departmentCode);
        const coords =
          e.lngLat != null ? [e.lngLat.lng, e.lngLat.lat] as [number, number] : null;

        if (coords) {
          popupRef.current?.remove();
          if (stat?.masked) {
            popupRef.current = new mapboxgl.Popup({ closeOnClick: true })
              .setLngLat(coords)
              .setHTML(`<strong>${departmentName}</strong><br/><em>${t("choropleth.insufficientData")}</em>`)
              .addTo(map);
            return;
          }

          const diagnoses = formatDiagnosesList(
            stat?.dominantDiagnoses,
            unknownLabel
          );
          popupRef.current = new mapboxgl.Popup({ closeOnClick: true })
            .setLngLat(coords)
            .setHTML(
              [
                `<strong>${departmentName}</strong>`,
                stat
                  ? `${t("activeCases", { count: stat.activeCasesCount })}`
                  : t("choropleth.noData"),
                stat?.farmsAffectedCount != null
                  ? `${t("farms", { count: stat.farmsAffectedCount })}`
                  : "",
                diagnoses
                  ? `<span style="opacity:0.85">${diagnoses}</span>`
                  : ""
              ]
                .filter(Boolean)
                .join("<br/>")
            )
            .addTo(map);
        }
      };

      deptClickRef.current = onDeptClick;
      deptMoveRef.current = onDeptMove;
      deptLeaveRef.current = onDeptLeave;
      map.on("click", CHOROPLETH_LAYER_IDS.fill, onDeptClick);
      map.on("mousemove", CHOROPLETH_LAYER_IDS.fill, onDeptMove);
      map.on("mouseleave", CHOROPLETH_LAYER_IDS.fill, onDeptLeave);
    };

    const renderPoints = () => {
      detachChoroplethLayers();

      const zoneSourceId = "health-zones";
      const pointSourceId = "health-points";
      const showZoneCircles = mapDataMode !== "aggregated";
      const showPointMarkers =
        mapDataMode !== "aggregated" && visiblePoints.length > 0;

      const zoneFeatures: GeoJSON.Feature[] = zones
        .filter((z) => !z.masked && z.centerLat != null && z.centerLng != null)
        .map((z) => ({
          type: "Feature",
          properties: {
            zoneId: z.id,
            label: z.label,
            activeCases: z.activeCases ?? 0,
            radius: zoneRadius(z.activeCases ?? 0, maxZoneActive),
            selected: z.id === selectedZoneId ? 1 : 0
          },
          geometry: {
            type: "Point",
            coordinates: [z.centerLng as number, z.centerLat as number]
          }
        }));

      const pointFeatures: GeoJSON.Feature[] = visiblePoints.map((p) => ({
        type: "Feature",
        properties: {
          diagnosis: p.diagnosis,
          farmName: p.farmName,
          severity: p.severity ?? "",
          color: severityColor(p.severity)
        },
        geometry: {
          type: "Point",
          coordinates: [p.lng, p.lat]
        }
      }));

      const upsertSource = (id: string, data: GeoJSON.FeatureCollection) => {
        const existingSource = map.getSource(id);
        if (existingSource && "setData" in existingSource) {
          (existingSource as mapboxgl.GeoJSONSource).setData(data);
          return;
        }
        map.addSource(id, { type: "geojson", data });
      };

      upsertSource(zoneSourceId, {
        type: "FeatureCollection",
        features: showZoneCircles ? zoneFeatures : []
      });
      upsertSource(pointSourceId, {
        type: "FeatureCollection",
        features: showPointMarkers ? pointFeatures : []
      });

      if (showZoneCircles && !map.getLayer(CHOROPLETH_LAYER_IDS.zoneCircles)) {
        map.addLayer({
          id: CHOROPLETH_LAYER_IDS.zoneCircles,
          type: "circle",
          source: zoneSourceId,
          paint: {
            "circle-radius": ["get", "radius"],
            "circle-color": [
              "case",
              ["==", ["get", "selected"], 1],
              "#7C3AED",
              "#FB7185"
            ],
            "circle-opacity": 0.35,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#BE123C"
          }
        });
      }

      if (showPointMarkers && !map.getLayer(CHOROPLETH_LAYER_IDS.points)) {
        map.addLayer({
          id: CHOROPLETH_LAYER_IDS.points,
          type: "circle",
          source: pointSourceId,
          paint: {
            "circle-radius": 7,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.9,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#fff"
          }
        });
      }

      const onZoneClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        const zoneId = f?.properties?.zoneId as string | undefined;
        if (!zoneId) return;
        onZoneSelect?.(zoneId === selectedZoneId ? null : zoneId);
        const coords =
          f?.geometry?.type === "Point" ? f.geometry.coordinates : null;
        if (coords) {
          map.flyTo({ center: [coords[0], coords[1]], zoom: 11, duration: 800 });
        }
      };

      const onPointClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.geometry || f.geometry.type !== "Point") return;
        const [lng, lat] = f.geometry.coordinates;
        const diagnosis = f.properties?.diagnosis ?? unknownLabel;
        const farmName = f.properties?.farmName ?? "";
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup()
          .setLngLat([lng, lat])
          .setHTML(
            `<strong>${diagnosis}</strong><br/><span style="opacity:0.85">${farmName}</span>`
          )
          .addTo(map);
      };

      if (showZoneCircles) {
        if (zoneClickRef.current) {
          map.off("click", CHOROPLETH_LAYER_IDS.zoneCircles, zoneClickRef.current);
        }
        zoneClickRef.current = onZoneClick;
        map.on("click", CHOROPLETH_LAYER_IDS.zoneCircles, onZoneClick);
      } else if (zoneClickRef.current) {
        map.off("click", CHOROPLETH_LAYER_IDS.zoneCircles, zoneClickRef.current);
        zoneClickRef.current = null;
      }

      if (showPointMarkers) {
        if (pointClickRef.current) {
          map.off("click", CHOROPLETH_LAYER_IDS.points, pointClickRef.current);
        }
        pointClickRef.current = onPointClick;
        map.on("click", CHOROPLETH_LAYER_IDS.points, onPointClick);
      } else if (pointClickRef.current) {
        map.off("click", CHOROPLETH_LAYER_IDS.points, pointClickRef.current);
        pointClickRef.current = null;
      }
    };

    const render = () => {
      if (renderMode === "choropleth" && geoJsonRef.current) {
        renderChoropleth();
        return;
      }
      if (renderMode === "points") {
        renderPoints();
      }
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once("load", render);
    }

    return () => {
      detachPointsLayers();
      detachChoroplethLayers();
      map.off("load", render);
    };
  }, [
    zones,
    visiblePoints,
    maxZoneActive,
    selectedZoneId,
    selectedDepartmentCode,
    onZoneSelect,
    t,
    token,
    renderMode,
    statsByDepartment,
    intensityMetric,
    geoReady,
    mapDataMode
  ]);

  if (!token) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-xl text-sm text-muted-foreground p-8 border border-dashed border-border",
          className
        )}
      >
        {t("tokenMissing")}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div ref={containerRef} className="h-full w-full rounded-xl overflow-hidden" />
      {renderMode === "choropleth" ? (
        <HealthMapChoroplethLegend
          maxIntensity={maxChoroplethIntensity}
          metric={intensityMetric}
          className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[200px] rounded-xl border border-white/70 bg-white/90 p-3 shadow-glass backdrop-blur-sm"
        />
      ) : null}
    </div>
  );
}
