"use client";

/**
 * LocationPicker — tap-to-pin Leaflet map for report geolocation.
 *
 * Props:
 *   initialLat / initialLng  — starting pin position (optional)
 *   onConfirm(lat, lng, name) — called when the user confirms their location
 *   onCancel                  — called when the user dismisses without confirming
 */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon paths broken by Next.js asset pipeline
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Demo city fallback — Lagos
const DEFAULT_LAT = 6.4541;
const DEFAULT_LNG = 3.4218;
const DEFAULT_ZOOM = 14;

import { reverseGeocode } from "@/lib/geocode";

interface Props {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number, name: string | null) => void;
  onCancel: () => void;
}

export default function LocationPicker({ initialLat, initialLng, onConfirm, onCancel }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markerRef  = useRef<L.Marker | null>(null);

  const startLat = initialLat ?? DEFAULT_LAT;
  const startLng = initialLng ?? DEFAULT_LNG;

  const [pinLat, setPinLat] = useState(startLat);
  const [pinLng, setPinLng] = useState(startLng);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Reverse geocode whenever pin moves
  useEffect(() => {
    setGeocoding(true);
    setPlaceName(null);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const name = await reverseGeocode(pinLat, pinLng);
      if (!controller.signal.aborted) {
        setPlaceName(name);
        setGeocoding(false);
      }
    }, 400); // debounce
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pinLat, pinLng]);

  // Initialise the Leaflet map once
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const map = L.map(mapRef.current, {
      center: [startLat, startLng],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Initial marker
    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    // Drag updates pin
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      setPinLat(pos.lat);
      setPinLng(pos.lng);
    });

    // Tap anywhere to move pin
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setPinLat(e.latlng.lat);
      setPinLng(e.latlng.lng);
    });

    leafletRef.current = map;

    return () => {
      map.remove();
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm() {
    onConfirm(pinLat, pinLng, placeName);
  }

  return (
    <div className="flex flex-col gap-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Instruction bar */}
      <div className="bg-teal-700 px-4 py-2.5 flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="text-xs font-semibold text-white">
          Tap the map or drag the pin to your location
        </span>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: 280, width: "100%" }} />

      {/* Location name + confirm */}
      <div className="bg-white px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {geocoding ? (
            <p className="text-xs text-slate-400 animate-pulse">Finding address…</p>
          ) : placeName ? (
            <p className="text-xs font-medium text-slate-700 truncate">{placeName}</p>
          ) : (
            <p className="text-xs font-mono text-slate-500">
              {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
            </p>
          )}
          {!geocoding && placeName && (
            <p className="text-[10px] text-slate-400 font-mono">
              {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="text-xs font-semibold bg-teal-600 text-white px-4 py-2 rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
          >
            Use this location
          </button>
        </div>
      </div>
    </div>
  );
}
