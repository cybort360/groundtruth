"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet";
import type { AssessedEvent } from "@/types";

interface MapViewProps {
  events: AssessedEvent[];
  onEventClick?: (eventId: string) => void;
}

const EVENT_ICONS: Record<string, string> = {
  flooding: "🌊", earthquake: "🏚️", wildfire: "🔥", landslide: "⛰️",
  tsunami: "🌊", tropical_storm: "🌀", road_closure: "🚧", power_outage: "⚡",
  structural_damage: "🏗️", gas_leak: "💨", avalanche: "🏔️",
  volcanic_activity: "🌋", other: "⚠️",
};

function getEventIcon(eventType: string): string {
  return EVENT_ICONS[eventType] ?? "⚠️";
}

function getColor(confidence: number): string {
  if (confidence >= 0.8) return "#22c55e";
  if (confidence >= 0.5) return "#f59e0b";
  return "#ef4444";
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function getStatusLabel(status: AssessedEvent["status"]): string {
  switch (status) {
    case "active":   return "Active";
    case "resolved": return "Resolved";
    case "uncertain":return "Uncertain";
  }
}

/** Automatically pan + zoom the map to show all events. */
function FitBounds({ events }: { events: AssessedEvent[] }) {
  const map = useMap();

  useEffect(() => {
    if (events.length === 0) return;

    if (events.length === 1) {
      map.setView([events[0].latitude, events[0].longitude], 14);
      return;
    }

    const lats = events.map((e) => e.latitude);
    const lngs = events.map((e) => e.longitude);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats) - 0.005, Math.min(...lngs) - 0.005],
      [Math.max(...lats) + 0.005, Math.max(...lngs) + 0.005],
    ];
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, events]);

  return null;
}

// Use locally-cached tiles when NEXT_PUBLIC_OFFLINE_TILES=true (set after running npm run tiles:download)
const OFFLINE_TILES = process.env.NEXT_PUBLIC_OFFLINE_TILES === "true";
const TILE_URL = OFFLINE_TILES
  ? "/tiles/{z}/{x}/{y}.png"
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function MapView({ events, onEventClick }: MapViewProps) {
  // Default center: Lekki, Lagos — overridden by FitBounds when events exist
  const defaultCenter: [number, number] = [6.4400, 3.4700];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url={TILE_URL}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        {...(OFFLINE_TILES ? { crossOrigin: false } : {})}
      />

      <FitBounds events={events} />

      {events.map((event) => {
        const color = getColor(event.confidence);
        const radiusMeters = event.radiusMeters > 0 ? event.radiusMeters : 300;
        const radius = Math.max(100, Math.min(radiusMeters, 3000));
        const reportCount = event.signals?.length ?? event.signalCount;

        return (
          <Circle
            key={event.id}
            center={[event.latitude, event.longitude] as [number, number]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.35,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: "160px" }}>
                <p style={{ fontWeight: "bold", marginBottom: "4px" }}>
                  {getEventIcon(event.eventType)} {event.title}
                </p>
                <p style={{ color, fontWeight: "600", marginBottom: "4px" }}>
                  {formatConfidence(event.confidence)} confidence
                </p>
                <p style={{ marginBottom: "4px", color: "#6b7280" }}>
                  {getStatusLabel(event.status)} · {reportCount} report{reportCount !== 1 ? "s" : ""}
                </p>
                {event.conflicts?.length > 0 && (
                  <p style={{ color: "#d97706", marginBottom: "4px", fontSize: "12px" }}>
                    ⚠ {event.conflicts.length} conflict{event.conflicts.length !== 1 ? "s" : ""} detected
                  </p>
                )}
                {onEventClick && (
                  <button
                    onClick={() => onEventClick(event.id)}
                    style={{
                      marginTop: "6px",
                      fontSize: "12px",
                      padding: "3px 10px",
                      background: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    View details
                  </button>
                )}
              </div>
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
