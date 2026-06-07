"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { HealthMapDto } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  points: HealthMapDto["points"];
  className?: string;
};

const WEST_AFRICA: [number, number] = [-5, 10];

export function HealthMapbox({ points, className }: Props) {
  const t = useTranslations("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();

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
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;

    const unknownLabel = t("unknownDiagnosis");

    const render = () => {
      const sourceId = "health-points";
      const data: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          properties: {
            diagnosis: p.diagnosis,
            severity: p.severity ?? ""
          },
          geometry: {
            type: "Point",
            coordinates: [p.lng, p.lat]
          }
        }))
      };

      const existing = map.getSource(sourceId);
      if (existing && "setData" in existing) {
        (existing as mapboxgl.GeoJSONSource).setData(data);
        return;
      }

      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: "health-circles",
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 8,
          "circle-color": "#E53935",
          "circle-opacity": 0.75,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff"
        }
      });

      map.on("click", "health-circles", (e) => {
        const f = e.features?.[0];
        if (!f?.geometry || f.geometry.type !== "Point") return;
        const [lng, lat] = f.geometry.coordinates;
        const diagnosis = f.properties?.diagnosis ?? unknownLabel;
        new mapboxgl.Popup()
          .setLngLat([lng, lat])
          .setHTML(`<strong>${diagnosis}</strong>`)
          .addTo(map);
      });
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once("load", render);
    }
  }, [points, t, token]);

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
