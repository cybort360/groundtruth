"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet";
import type { AssessedEvent, NormalizedSignal } from "@/types";

// ── Risk colour helpers ───────────────────────────────────────────────────────

/**
 * Credibility-weighted severity from an event's signals.
 * Mirrors the same logic in EventCard so map colours stay consistent with cards.
 */
function deriveSeverity(signals: NormalizedSignal[]): number {
  if (!signals?.length) return 3;
  const totalWeight = signals.reduce((s, sig) => s + sig.credibilityScore, 0);
  if (totalWeight === 0) return 3;
  const weighted = signals.reduce((s, sig) => s + sig.severity * sig.credibilityScore, 0);
  return Math.min(5, Math.max(1, Math.round(weighted / totalWeight)));
}

interface RiskColors {
  stroke: string;
  fill:   string;
  label:  string;
}

/**
 * Colour encodes DANGER, not confidence.
 * High confidence of a dangerous event should be red, not green.
 *
 * Resolved  → slate  (threat gone)
 * Uncertain → amber  (watching, unconfirmed)
 * Active    → orange → red, scaled by severity + confidence
 */
function getRiskColors(event: AssessedEvent): RiskColors {
  if (event.status === "resolved") {
    return { stroke: "#64748b", fill: "#94a3b8", label: "Resolved" };
  }
  if (event.status === "uncertain") {
    return { stroke: "#d97706", fill: "#fbbf24", label: "Uncertain" };
  }

  const severity = deriveSeverity(event.signals ?? []);

  if (severity >= 4 && event.confidence >= 0.6) {
    return { stroke: "#b91c1c", fill: "#ef4444", label: "Critical" };
  }
  if (severity >= 4 || event.confidence >= 0.75) {
    return { stroke: "#c2410c", fill: "#f97316", label: "High" };
  }
  if (severity >= 3 || event.confidence >= 0.5) {
    return { stroke: "#b45309", fill: "#f59e0b", label: "Moderate" };
  }
  return { stroke: "#065f46", fill: "#10b981", label: "Low" };
}

// ── Event type label ──────────────────────────────────────────────────────────

const EVENT_TYPE_LABEL: Record<string, string> = {
  flooding:          "Flooding",
  earthquake:        "Earthquake",
  wildfire:          "Wildfire",
  landslide:         "Landslide",
  tsunami:           "Tsunami",
  tropical_storm:    "Tropical Storm",
  road_closure:      "Road Closure",
  power_outage:      "Power Outage",
  structural_damage: "Structural Damage",
  gas_leak:          "Gas Leak",
  avalanche:         "Avalanche",
  volcanic_activity: "Volcanic Activity",
  other:             "Incident",
};

// ── FitBounds ─────────────────────────────────────────────────────────────────

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

// ── FlyTo — animates to a geocoded location ───────────────────────────────────

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 13, { duration: 1.2 });
  }, [map, lat, lng]);
  return null;
}

// ── Popup HTML builder ────────────────────────────────────────────────────────

function buildPopupHtml(event: AssessedEvent, onEventClick?: (id: string) => void): string {
  const { fill, stroke, label } = getRiskColors(event);
  const severity    = deriveSeverity(event.signals ?? []);
  const reportCount = event.signals?.length ?? event.signalCount;
  const typeLabel   = EVENT_TYPE_LABEL[event.eventType] ?? "Incident";
  const confPct     = Math.round(event.confidence * 100);

  const conflictRow = (event.conflicts?.length ?? 0) > 0
    ? `<p style="color:#b45309;font-size:11px;margin:0 0 6px">
         ⚠ ${event.conflicts.length} conflicting report${event.conflicts.length !== 1 ? "s" : ""}
       </p>`
    : "";

  const btnRow = onEventClick
    ? `<button
         onclick="window.__gtEventClick__('${event.id}')"
         style="margin-top:4px;font-size:12px;padding:4px 12px;background:${fill};color:#fff;
                border:none;border-radius:6px;cursor:pointer;font-weight:600">
         View details
       </button>`
    : "";

  return `
    <div style="min-width:175px;font-family:system-ui,sans-serif;font-size:13px;line-height:1.4">
      <p style="font-weight:700;margin:0 0 4px;color:#0f172a">${event.title}</p>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
        <span style="background:${fill};color:#fff;font-size:11px;font-weight:700;
                     padding:2px 8px;border-radius:999px">${label}</span>
        <span style="color:#64748b;font-size:11px">${typeLabel}</span>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:6px">
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Confidence</div>
          <div style="font-weight:700;color:${stroke}">${confPct}%</div>
        </div>
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Severity</div>
          <div style="font-weight:700;color:${stroke}">${severity}/5</div>
        </div>
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Reports</div>
          <div style="font-weight:700;color:#334155">${reportCount}</div>
        </div>
      </div>
      ${conflictRow}
      ${btnRow}
    </div>`;
}

// ── Tile source ───────────────────────────────────────────────────────────────

const OFFLINE_TILES = process.env.NEXT_PUBLIC_OFFLINE_TILES === "true";
const TILE_URL = OFFLINE_TILES
  ? "/tiles/{z}/{x}/{y}.png"
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

// ── Main component ────────────────────────────────────────────────────────────

interface MapViewProps {
  events: AssessedEvent[];
  onEventClick?: (eventId: string) => void;
  centerOverride?: [number, number] | null;
}

export default function MapView({ events, onEventClick, centerOverride }: MapViewProps) {
  const defaultCenter: [number, number] = [6.4400, 3.4700];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      // #e8e4de matches OSM's unloaded tile background — offline tiles blend in
      // instead of showing broken-image icons on a white square.
      style={{ height: "100%", width: "100%", background: "#e8e4de" }}
    >
      <TileLayer
        url={TILE_URL}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        {...(OFFLINE_TILES ? { crossOrigin: false } : {})}
        eventHandlers={{
          tileerror: (e) => {
            // Hide tiles that failed to load — the gray container background
            // shows through cleanly instead of showing a broken-image icon.
            const img = e.tile as HTMLImageElement;
            img.style.display = "none";
          },
        }}
      />

      {/* Use FlyTo when the user has searched a location; otherwise auto-fit events */}
      {centerOverride
        ? <FlyTo lat={centerOverride[0]} lng={centerOverride[1]} />
        : <FitBounds events={events} />
      }

      {/*
        Two-ring zones per event:
          1. Outer ring  — full radiusMeters, low opacity.
             Dashed border for uncertain events.
          2. Inner ring  — 35 % of radius, high opacity.
             Creates an "epicentre" gradient effect without canvas.
        Rendered in two separate loops so inner rings always paint on top.
      */}

      {/* Outer rings */}
      {events.map((event) => {
        const { stroke, fill } = getRiskColors(event);
        const outerRadius = Math.max(150, Math.min(event.radiusMeters || 300, 2500));
        const center: [number, number] = [event.latitude, event.longitude];

        return (
          <Circle
            key={`${event.id}-outer`}
            center={center}
            radius={outerRadius}
            pathOptions={{
              color:       stroke,
              fillColor:   fill,
              fillOpacity: event.status === "resolved" ? 0.07 : 0.13,
              weight:      1.5,
              dashArray:   event.status === "uncertain" ? "6 4" : undefined,
            }}
          >
            <Popup>
              <div dangerouslySetInnerHTML={{ __html: buildPopupHtml(event, onEventClick) }} />
            </Popup>
          </Circle>
        );
      })}

      {/* Inner epicentre rings */}
      {events.map((event) => {
        const { stroke, fill } = getRiskColors(event);
        const outerRadius = Math.max(150, Math.min(event.radiusMeters || 300, 2500));
        const innerRadius = Math.round(outerRadius * 0.35);
        const center: [number, number] = [event.latitude, event.longitude];

        return (
          <Circle
            key={`${event.id}-inner`}
            center={center}
            radius={innerRadius}
            pathOptions={{
              color:       stroke,
              fillColor:   fill,
              fillOpacity: event.status === "resolved" ? 0.18 : 0.42,
              weight:      2,
            }}
          >
            <Popup>
              <div dangerouslySetInnerHTML={{ __html: buildPopupHtml(event, onEventClick) }} />
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
