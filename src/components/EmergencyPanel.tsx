"use client";

import { useState, useEffect } from "react";

// ── Regional emergency numbers ────────────────────────────────────────────────

interface AgencyNumber {
  number: string;
  label: string;
  note: string;
}

function getRegionalNumbers(lat: number, lng: number): AgencyNumber[] {
  // Nigeria / West Africa
  if (lat > 4 && lat < 14 && lng > 2 && lng < 15) {
    return [
      { number: "112",          label: "National Emergency", note: "Police · Fire · Ambulance" },
      { number: "767",          label: "LASEMA",             note: "Lagos State Emergency Mgmt" },
      { number: "199",          label: "Fire Service",       note: "National" },
      { number: "08032003736",  label: "NEMA",               note: "National Emergency Mgmt" },
    ];
  }
  // United States & Canada
  if (lat > 24 && lat < 72 && lng > -170 && lng < -52) {
    return [
      { number: "911", label: "Emergency",     note: "Police · Fire · EMS" },
      { number: "112", label: "International", note: "Backup — works on any network" },
    ];
  }
  // United Kingdom
  if (lat > 49 && lat < 61 && lng > -9 && lng < 2) {
    return [
      { number: "999", label: "Emergency",     note: "Police · Fire · Ambulance" },
      { number: "112", label: "International", note: "Backup" },
    ];
  }
  // European Union
  if (lat > 35 && lat < 72 && lng > -10 && lng < 32) {
    return [
      { number: "112", label: "Emergency",   note: "EU universal — Police · Fire · EMS" },
    ];
  }
  // India
  if (lat > 8 && lat < 38 && lng > 68 && lng < 97) {
    return [
      { number: "112", label: "Emergency",  note: "National unified emergency" },
      { number: "100", label: "Police",     note: "" },
      { number: "101", label: "Fire",       note: "" },
      { number: "102", label: "Ambulance",  note: "" },
    ];
  }
  // Australia & NZ
  if (lat > -47 && lat < -10 && lng > 113 && lng < 179) {
    return [
      { number: "000", label: "Emergency",     note: "Police · Fire · Ambulance (AU)" },
      { number: "111", label: "Emergency",     note: "New Zealand" },
      { number: "112", label: "International", note: "Backup — works on any network" },
    ];
  }
  // South Africa
  if (lat > -35 && lat < -22 && lng > 16 && lng < 33) {
    return [
      { number: "10111", label: "Police",      note: "SAPS" },
      { number: "10177", label: "Ambulance",   note: "EMS" },
      { number: "112",   label: "International", note: "Backup" },
    ];
  }
  // Default — international
  return [
    { number: "112", label: "Emergency", note: "Works in most countries on any network" },
  ];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmergencyPanel() {
  const [expanded, setExpanded]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [lat, setLat]             = useState<number | null>(null);
  const [lng, setLng]             = useState<number | null>(null);
  const [locStatus, setLocStatus] = useState<"acquiring" | "ready" | "failed">("acquiring");

  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus("failed"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocStatus("ready");
      },
      () => setLocStatus("failed"),
      { timeout: 8000, enableHighAccuracy: true },
    );
  }, []);

  const mapsUrl =
    lat !== null && lng !== null
      ? `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
      : null;

  const smsBody =
    lat !== null && lng !== null
      ? encodeURIComponent(
          `EMERGENCY SOS — I need rescue assistance.\nLocation: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nSent via GroundTruth.`,
        )
      : encodeURIComponent("EMERGENCY SOS — I need rescue assistance. Please call me immediately.");

  const regionalNumbers =
    lat !== null && lng !== null ? getRegionalNumbers(lat, lng) : [];
  const primaryNumber = regionalNumbers[0]?.number ?? "112";

  function copyLocation() {
    if (!mapsUrl) return;
    void navigator.clipboard.writeText(mapsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-rose-300 bg-rose-50 shadow-sm">

      {/* ── Always-visible primary strip ── */}
      <div className="px-4 pt-4 pb-3">

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          {/* Pulse beacon */}
          <span className="relative flex-shrink-0">
            <span className="w-3 h-3 bg-rose-500 rounded-full block" />
            <span className="absolute inset-0 w-3 h-3 bg-rose-400 rounded-full animate-ping opacity-75" />
          </span>
          <div>
            <p className="text-sm font-bold text-rose-800 leading-tight">Need rescue?</p>
            <p className="text-[11px] text-rose-500 leading-tight">
              Call emergency services first — then submit a report.
            </p>
          </div>
        </div>

        {/* Primary actions */}
        <div className="flex gap-2">
          {/* Call */}
          <a
            href={`tel:${primaryNumber}`}
            className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.23h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.1 6.1l.38-.38a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Call {primaryNumber}
          </a>

          {/* SMS my location */}
          <a
            href={`sms:${primaryNumber}?body=${smsBody}`}
            className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-rose-50 text-rose-700 font-bold text-sm py-3 rounded-xl border-2 border-rose-200 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            SMS Location
          </a>
        </div>

        {/* Location status */}
        <div className="mt-2.5 flex items-center justify-between">
          <p className="text-[11px] text-rose-500 font-medium">
            {locStatus === "acquiring" && "📡 Acquiring GPS…"}
            {locStatus === "failed"    && "⚠ GPS unavailable — share your address verbally"}
            {locStatus === "ready"     && `📍 ${lat!.toFixed(5)}, ${lng!.toFixed(5)}`}
          </p>
          {locStatus === "ready" && (
            <button
              onClick={copyLocation}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors"
            >
              {copied ? "✓ Copied" : "Copy link"}
            </button>
          )}
        </div>
      </div>

      {/* ── Expand toggle ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-rose-100 hover:bg-rose-200 transition-colors border-t border-rose-200 text-left"
      >
        <span className="text-[11px] font-semibold text-rose-700">
          {expanded ? "Hide local agencies" : "See local agency numbers & guidance"}
        </span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          className={`w-3.5 h-3.5 text-rose-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* ── Expanded: regional numbers + guidance ── */}
      {expanded && (
        <div className="px-4 py-3 bg-white border-t border-rose-100 animate-expand space-y-3">

          {/* Regional numbers */}
          {regionalNumbers.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Local emergency numbers
              </p>
              <div className="space-y-1.5">
                {regionalNumbers.map((agency) => (
                  <a
                    key={agency.number}
                    href={`tel:${agency.number}`}
                    className="flex items-center justify-between bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 rounded-xl px-3.5 py-2.5 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight group-hover:text-rose-700">
                        {agency.label}
                      </p>
                      {agency.note && (
                        <p className="text-[11px] text-slate-400 leading-tight">{agency.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-slate-600 group-hover:text-rose-600 tabular-nums">
                        {agency.number}
                      </span>
                      <span className="w-7 h-7 flex items-center justify-center rounded-full bg-rose-100 group-hover:bg-rose-500 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                          strokeLinecap="round" strokeLinejoin="round"
                          className="w-3.5 h-3.5 text-rose-500 group-hover:text-white transition-colors">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.23h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.1 6.1l.38-.38a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Enable location to see numbers for your area. Default: dial 112.
            </p>
          )}

          {/* What to say */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
              What to tell them
            </p>
            <ul className="text-xs text-amber-800 space-y-1 leading-relaxed">
              <li>• <strong>Your location</strong> — street name, landmark, or GPS coordinates</li>
              <li>• <strong>Nature of emergency</strong> — flooding / collapsed structure / wildfire / injury</li>
              <li>• <strong>Number of people</strong> — how many need rescue</li>
              <li>• <strong>Your condition</strong> — injured, trapped, or mobile</li>
              <li>• <strong>Stay on the line</strong> — don't hang up until told to</li>
            </ul>
          </div>

          {/* Share via native share */}
          {mapsUrl && typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={() => {
                void navigator.share({
                  title: "Emergency SOS — My Location",
                  text: `I need rescue assistance. My location: ${mapsUrl}`,
                  url: mapsUrl,
                });
              }}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share My Location
            </button>
          )}
        </div>
      )}
    </div>
  );
}
