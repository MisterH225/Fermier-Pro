"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { HealthMapDto, HealthMapZone } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  points?: HealthMapDto["points"];
  zones: HealthMapZone[];
  selectedZoneId: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  className?: string;
};

const WEST_AFRICA: [number, number] = [-8, 10];

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

export function HealthMapbox({
  points,
  zones,
  selectedZoneId,
  onZoneSelect,
  className
}: Props) {
  const t = useTranslations("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const zoneClickRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);
  const pointClickRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();

  const maxZoneActive = useMemo(
    () => Math.max(0, ...zones.map((z) => z.activeCases ?? 0)),
    [zones]
  );

  const visiblePoints = useMemo(
    () => {
      const list = points ?? [];
      return selectedZoneId
        ? list.filter((p) => p.zoneId === selectedZoneId)
        : list;
    },
    [points, selectedZoneId]
  );

  useEffect(() => {
    if (!containerRef.current || !token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: WEST_AFRICA,
      zoom: 4.2
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;

    const unknownLabel = t("unknownDiagnosis");

    const render = () => {
      const zoneSourceId = "health-zones";
      const pointSourceId = "health-points";

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

      const upsertSource = (
        id: string,
        data: GeoJSON.FeatureCollection
      ) => {
        const existing = map.getSource(id);
        if (existing && "setData" in existing) {
          (existing as mapboxgl.GeoJSONSource).setData(data);
          return;
        }
        map.addSource(id, { type: "geojson", data });
      };

      upsertSource(zoneSourceId, {
        type: "FeatureCollection",
        features: zoneFeatures
      });
      upsertSource(pointSourceId, {
        type: "FeatureCollection",
        features: pointFeatures
      });

      if (!map.getLayer("health-zone-circles")) {
        map.addLayer({
          id: "health-zone-circles",
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

      if (!map.getLayer("health-circles")) {
        map.addLayer({
          id: "health-circles",
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

      if (zoneClickRef.current) {
        map.off("click", "health-zone-circles", zoneClickRef.current);
      }
      if (pointClickRef.current) {
        map.off("click", "health-circles", pointClickRef.current);
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

      zoneClickRef.current = onZoneClick;
      pointClickRef.current = onPointClick;
      map.on("click", "health-zone-circles", onZoneClick);
      map.on("click", "health-circles", onPointClick);
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once("load", render);
    }
  }, [
    zones,
    visiblePoints,
    maxZoneActive,
    selectedZoneId,
    onZoneSelect,
    t,
    token
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

  return <div ref={containerRef} className={cn("rounded-xl overflow-hidden", className)} />;
}
