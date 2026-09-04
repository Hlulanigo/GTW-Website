import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ORIGIN_ICON = L.divIcon({
  html: `<div style="width:28px;height:28px;background:#FF6B35;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
  </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const DEST_ICON = L.divIcon({
  html: `<div style="width:28px;height:28px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
  </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

interface OSMMapProps {
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  originLabel?: string;
  destinationLabel?: string;
  className?: string;
  height?: string;
}

export function OSMMap({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  originLabel = "Pickup",
  destinationLabel = "Delivery",
  className = "",
  height = "220px",
}: OSMMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const hasOrigin = originLat != null && originLng != null;
    const hasDest = destinationLat != null && destinationLng != null;
    if (!hasOrigin && !hasDest) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const center: [number, number] = hasOrigin
      ? [originLat!, originLng!]
      : [destinationLat!, destinationLng!];

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const points: [number, number][] = [];

    if (hasOrigin) {
      L.marker([originLat!, originLng!], { icon: ORIGIN_ICON })
        .addTo(map)
        .bindPopup(`<strong>Pickup</strong><br/>${originLabel}`);
      points.push([originLat!, originLng!]);
    }

    if (hasDest) {
      L.marker([destinationLat!, destinationLng!], { icon: DEST_ICON })
        .addTo(map)
        .bindPopup(`<strong>Delivery</strong><br/>${destinationLabel}`);
      points.push([destinationLat!, destinationLng!]);
    }

    if (hasOrigin && hasDest) {
      L.polyline(
        [
          [originLat!, originLng!],
          [destinationLat!, destinationLng!],
        ],
        { color: "#FF6B35", weight: 3, opacity: 0.75, dashArray: "8 6" }
      ).addTo(map);
    }

    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [originLat, originLng, destinationLat, destinationLng, originLabel, destinationLabel]);

  const hasCoords =
    (originLat != null && originLng != null) ||
    (destinationLat != null && destinationLng != null);

  if (!hasCoords) return null;

  return (
    <div
      className={`rounded-xl overflow-hidden border border-slate-200 dark:border-navy-light ${className}`}
      style={{ height }}
    >
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
