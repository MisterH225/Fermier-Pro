"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { HealthMapDto } from "@/lib/api";

type Props = {
  points: HealthMapDto["points"];
  className?: string;
};

const WEST_AFRICA: [number, number] = [-5, 10];

export function HealthMapbox({ points, className }: Props) {
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
        const diagnosis = f.properties?.diagnosis ?? "Maladie";
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
  }, [points, token]);

  if (!token) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 rounded-xl text-sm text-slate-500 p-8 ${className ?? ""}`}
      >
        NEXT_PUBLIC_MAPBOX_TOKEN manquant
      </div>
    );
  }

  return <div ref={containerRef} className={`rounded-xl overflow-hidden ${className ?? ""}`} />;
}
