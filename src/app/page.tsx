"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EventCard from "@/components/EventCard";
import MapViewLoader from "@/components/MapViewLoader";
import ActionAdvisor from "@/components/ActionAdvisor";
import MeshStatus from "@/components/MeshStatus";
import { EventTypeIcon, IncidentIcon, CheckCircleIcon, SearchIcon } from "@/components/icons";
import { useOffline } from "@/lib/use-offline";
import type { AssessedEvent } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRelativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Low-bandwidth detection ───────────────────────────────────────────────────

type NavConnection = EventTarget & { effectiveType?: string; saveData?: boolean };

function detectSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as { connection?: NavConnection }).connection;
  if (!conn) return false;
  return conn.saveData === true || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-slate-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-slate-200 rounded-full w-3/4" />
          <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
        </div>
        <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0" />
      </div>
    </div>
  );
}

// ── Filter pills ──────────────────────────────────────────────────────────────

const ALL_EVENT_TYPES = [
  { value: "flooding",          label: "Flooding" },
  { value: "earthquake",        label: "Earthquake" },
  { value: "wildfire",          label: "Wildfire" },
  { value: "landslide",         label: "Landslide" },
  { value: "tsunami",           label: "Tsunami" },
  { value: "tropical_storm",    label: "Storm" },
  { value: "road_closure",      label: "Road" },
  { value: "power_outage",      label: "Power" },
  { value: "structural_damage", label: "Structure" },
  { value: "gas_leak",          label: "Gas Leak" },
  { value: "avalanche",         label: "Avalanche" },
  { value: "volcanic_activity", label: "Volcano" },
  { value: "other",             label: "Other" },
] as const;

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [events, setEvents]                     = useState<AssessedEvent[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [changedIds, setChangedIds]             = useState<Set<string>>(new Set());
  const [error, setError]                       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]           = useState<string | null>(null);
  const [unanalyzedCount, setUnanalyzedCount]   = useState(0);
  const [analyzing, setAnalyzing]               = useState(false);
  const [lastAnalyzed, setLastAnalyzed]         = useState<string | null>(null);
  const [analyzeError, setAnalyzeError]         = useState<string | null>(null);
  const [filterType, setFilterType]             = useState<string>("all");
  const [minConfidence, setMinConfidence]       = useState<number>(0);
  const [sortOrder, setSortOrder]               = useState<"confidence" | "recency">("confidence");
  const [showFilterMenu, setShowFilterMenu]     = useState(false);
  const [mapExpanded, setMapExpanded]           = useState(false);
  const [lowBandwidth, setLowBandwidth]         = useState(false);
  const [showOverflow, setShowOverflow]         = useState(false);
  const [timeframeDays, setTimeframeDays]       = useState<1 | 3 | 7>(7);
  const { isOffline, ollamaReachable }          = useOffline();
  const intervalRef                             = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track previous confidence per event ID to detect changes between polls.
  const prevConfidence                          = useRef<Map<string, number>>(new Map());

  const fetchEvents = useCallback(async (isBackground = false) => {
    if (isBackground) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = (await res.json()) as { events: AssessedEvent[]; lastUpdated: string; unanalyzedCount: number };

      // Find events whose confidence shifted since the last poll.
      const changed = new Set<string>();
      for (const e of data.events) {
        const prev = prevConfidence.current.get(e.id);
        if (prev !== undefined && Math.abs(prev - e.confidence) > 0.005) {
          changed.add(e.id);
        }
      }
      prevConfidence.current = new Map(data.events.map((e) => [e.id, e.confidence]));

      setEvents(data.events);
      setLastUpdated(data.lastUpdated);
      setUnanalyzedCount(data.unanalyzedCount ?? 0);
      setError(null);

      if (changed.size > 0) {
        setChangedIds(changed);
        // Clear after the flash animation finishes (1 s).
        setTimeout(() => setChangedIds(new Set()), 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      if (isBackground) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  const triggerAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/reasoning", { method: "POST" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `Server returned ${res.status}`);
      }
      setLastAnalyzed(new Date().toISOString());
      // Refresh events to show newly assessed clusters
      await fetchEvents(true);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [fetchEvents]);

  useEffect(() => {
    void fetchEvents(false);
    intervalRef.current = setInterval(() => void fetchEvents(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchEvents]);

  // Auto-detect slow connection on mount and on connection change.
  useEffect(() => {
    setLowBandwidth(detectSlowConnection());
    const conn = (navigator as { connection?: NavConnection }).connection;
    if (!conn) return;
    const onchange = () => setLowBandwidth(detectSlowConnection());
    conn.addEventListener("change", onchange);
    return () => conn.removeEventListener("change", onchange);
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

  // Hard cutoff: events older than the selected timeframe are invisible.
  // 7 days is the maximum — nothing stale survives regardless of other filters.
  const cutoffMs = timeframeDays * 24 * 60 * 60 * 1000;
  const timeframeEvents = events.filter(
    (e) => Date.now() - new Date(e.lastUpdated).getTime() <= cutoffMs
  );

  const typeCounts = timeframeEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
    return acc;
  }, {});

  const visibleEvents = timeframeEvents
    .filter((e) => filterType === "all" || e.eventType === filterType)
    .filter((e) => e.confidence * 100 >= minConfidence)
    .sort((a, b) =>
      sortOrder === "confidence"
        ? b.confidence - a.confidence
        : new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

  const hasEvents = !loading && error === null && timeframeEvents.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="bg-teal-700 text-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Signal-ping mark: a ground point with two radar arcs above it */}
            <svg
              viewBox="0 0 28 28"
              fill="none"
              className="w-8 h-8 flex-shrink-0"
              aria-hidden="true"
            >
              {/* Base dot — the "ground truth" anchor point */}
              <circle cx="14" cy="20" r="2.2" fill="white" />
              {/* Inner arc */}
              <path
                d="M9.5 15.8 a6.5 6.5 0 0 1 9 0"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Outer arc */}
              <path
                d="M5.5 11.5 a11 11 0 0 1 17 0"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.45"
              />
            </svg>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white leading-tight">GroundTruth</h1>
              <p className="text-[11px] text-teal-200 leading-tight truncate">
                {isOffline ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Offline{ollamaReachable ? " · Gemma active" : ""}
                  </span>
                ) : lastUpdated ? (
                  `Updated ${getRelativeTime(lastUpdated)}`
                ) : (
                  "Situational Awareness"
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* ⋮ Overflow menu */}
            <div className="relative">
              <button
                onClick={() => setShowOverflow((v) => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors relative"
                aria-label="More options"
                aria-expanded={showOverflow}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <circle cx="12" cy="5"  r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
                {/* Amber dot when data saver is on */}
                {lowBandwidth && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full border border-teal-700" />
                )}
              </button>

              {showOverflow && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-40 w-52">

                  {/* Refresh */}
                  <button
                    onClick={() => { void fetchEvents(true); setShowOverflow(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400 flex-shrink-0">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    <span className="font-medium">Refresh data</span>
                  </button>

                  {/* Data saver toggle */}
                  <button
                    onClick={() => setLowBandwidth((v) => !v)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-50"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true">
                      <rect x="2"  y="16" width="4" height="6" rx="1" />
                      <rect x="9"  y="11" width="4" height="11" rx="1" opacity="0.6" />
                      <rect x="16" y="4"  width="4" height="18" rx="1" opacity="0.3" />
                    </svg>
                    <span className="font-medium flex-1 text-left">Data saver</span>
                    {/* iOS-style toggle */}
                    <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200 flex-shrink-0 ${
                      lowBandwidth ? "bg-teal-500" : "bg-slate-200"
                    }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        lowBandwidth ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </div>
                  </button>

                  {/* Settings */}
                  <a
                    href="/settings"
                    onClick={() => setShowOverflow(false)}
                    className="flex items-center gap-3 px-4 py-3.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400 flex-shrink-0">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span className="font-medium">Settings</span>
                  </a>
                </div>
              )}
            </div>

            {/* Submit report — primary CTA */}
            <a
              href="/report"
              className="flex items-center gap-1.5 bg-white text-teal-700 font-semibold text-xs px-3 py-1.5 rounded-xl hover:bg-teal-50 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Report
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pb-8">

        {/* ── Low-bandwidth banner ── */}
        {lowBandwidth && (
          <div className="mt-4 flex items-center justify-between bg-slate-800 text-white rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true">
                <rect x="2"  y="16" width="4" height="6" rx="1" opacity="0.35" />
                <rect x="9"  y="11" width="4" height="11" rx="1" opacity="0.35" />
                <rect x="16" y="4"  width="4" height="18" rx="1" opacity="0.35" />
                <line x1="3" y1="21" x2="21" y2="3" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-white leading-tight">Data saver on</p>
                <p className="text-[10px] text-slate-400 leading-tight">Map hidden · all reports still visible</p>
              </div>
            </div>
            <button
              onClick={() => setLowBandwidth(false)}
              className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors flex-shrink-0 ml-3"
            >
              Show full view
            </button>
          </div>
        )}

        {/* ── Map strip (context aid, not the hero) ── */}
        {!lowBandwidth && (
          <div className="mt-4">
            {/* Map container — always mounted so Leaflet tiles stay loaded.
                isolation:isolate traps Leaflet's internal z-indexes (200-400)
                so they can't paint over the header dropdown. */}
            <div
              className="rounded-2xl overflow-hidden border border-slate-100 transition-all duration-300 relative"
              style={{ height: mapExpanded ? 260 : 148, isolation: "isolate" }}
            >
              <MapViewLoader events={visibleEvents} />
              {/* Map legend — sits above Leaflet panes (z-index > 400) */}
              <div className="absolute bottom-2 left-2 z-[500] bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-2 shadow-sm border border-slate-100 pointer-events-none">
                {[
                  { color: "#ef4444", label: "Critical" },
                  { color: "#f97316", label: "High" },
                  { color: "#fbbf24", label: "Uncertain" },
                  { color: "#94a3b8", label: "Resolved" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5 leading-tight">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[10px] text-slate-600 font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expand / collapse toggle */}
            <button
              onClick={() => setMapExpanded((v) => !v)}
              className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400 hover:text-teal-600 transition-colors mx-auto block"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round"
                className={`w-3 h-3 transition-transform duration-200 ${mapExpanded ? "rotate-180" : ""}`}>
                <path d="M4 6l4 4 4-4" />
              </svg>
              {mapExpanded ? "Collapse map" : "Expand map"}
            </button>
          </div>
        )}

        {/* ── Type pills + unified Filter button ── */}
        <div className="mt-4 flex items-center gap-2">

          {/* Horizontally scrollable type pills */}
          <div className="flex-1 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 w-max pr-2">
              <button
                onClick={() => setFilterType("all")}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  filterType === "all"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-teal-300"
                }`}
              >
                All
                {hasEvents && (
                  <span className={`ml-1 ${filterType === "all" ? "text-teal-200" : "text-slate-400"}`}>
                    {timeframeEvents.length}
                  </span>
                )}
              </button>

              {ALL_EVENT_TYPES.map(({ value, label }) => {
                const count   = typeCounts[value] ?? 0;
                const active  = filterType === value;
                const hasData = count > 0;
                return (
                  <button
                    key={value}
                    onClick={() => setFilterType(value)}
                    className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                      active
                        ? "bg-teal-600 text-white shadow-sm"
                        : hasData
                          ? "bg-white text-slate-600 border border-slate-200 hover:border-teal-300"
                          : "bg-white text-slate-400 border border-slate-100 opacity-50"
                    }`}
                  >
                    <span className={active ? "text-teal-200" : hasData ? "text-slate-500" : "text-slate-300"}>
                      <EventTypeIcon type={value} className="w-3.5 h-3.5" />
                    </span>
                    {label}
                    {hasData && (
                      <span className={active ? "text-teal-200" : "text-slate-400"}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unified Filter button */}
          {(() => {
            const activeCount =
              (sortOrder !== "confidence" ? 1 : 0) +
              (minConfidence > 0 ? 1 : 0) +
              (timeframeDays < 7 ? 1 : 0);

            return (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowFilterMenu((v) => !v)}
                  aria-label="Filter and sort"
                  aria-expanded={showFilterMenu}
                  className={`relative flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                    activeCount > 0
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                  }`}
                >
                  {/* Funnel icon */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                    strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  Filter
                  {activeCount > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-teal-700 text-[10px] font-bold leading-none">
                      {activeCount}
                    </span>
                  )}
                </button>

                {showFilterMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 w-56 overflow-hidden">

                    {/* Sort by */}
                    <div className="px-3.5 pt-3 pb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sort by</p>
                      <div className="flex gap-1.5">
                        {(["confidence", "recency"] as const).map((val) => (
                          <button
                            key={val}
                            onClick={() => setSortOrder(val)}
                            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                              sortOrder === val
                                ? "bg-teal-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {val === "confidence" ? "Confidence" : "Recent"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mx-3.5 border-t border-slate-100" />

                    {/* Confidence */}
                    <div className="px-3.5 py-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Min confidence</p>
                      <div className="flex gap-1">
                        {([0, 50, 75, 90] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setMinConfidence(t)}
                            className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-colors ${
                              minConfidence === t
                                ? "bg-teal-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {t === 0 ? "Any" : `${t}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mx-3.5 border-t border-slate-100" />

                    {/* Timeframe */}
                    <div className="px-3.5 py-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Timeframe</p>
                      <div className="flex gap-1.5">
                        {([1, 3, 7] as const).map((days) => (
                          <button
                            key={days}
                            onClick={() => setTimeframeDays(days)}
                            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                              timeframeDays === days
                                ? "bg-teal-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {days === 1 ? "24h" : `${days}d`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reset — only shown when something is non-default */}
                    {activeCount > 0 && (
                      <>
                        <div className="mx-3.5 border-t border-slate-100" />
                        <button
                          onClick={() => {
                            setSortOrder("confidence");
                            setMinConfidence(0);
                            setTimeframeDays(7);
                          }}
                          className="w-full text-xs font-semibold text-slate-400 hover:text-rose-500 py-2.5 px-3.5 text-left transition-colors"
                        >
                          Reset filters
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Analysis strip ── */}
        <div className="mt-3 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5">
          <div className="min-w-0">
            {analyzing ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-semibold text-teal-700">Gemma is thinking…</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {unanalyzedCount > 0 ? (
                  <span className="text-xs font-semibold text-amber-600">
                    {unanalyzedCount} signal{unanalyzedCount !== 1 ? "s" : ""} waiting
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">All signals analyzed</span>
                )}
                {lastAnalyzed && (
                  <>
                    <span className="text-slate-200 text-xs">·</span>
                    <span className="text-xs text-slate-400">Last run {getRelativeTime(lastAnalyzed)}</span>
                  </>
                )}
                {analyzeError && (
                  <>
                    <span className="text-slate-200 text-xs">·</span>
                    <span className="text-xs text-rose-500 truncate">{analyzeError}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => void triggerAnalysis()}
            disabled={analyzing}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0 transition-colors ${
              analyzing
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-teal-600 hover:bg-teal-700 text-white"
            }`}
          >
            {/* Brain icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
            </svg>
            {analyzing ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {/* ── Status banner ── */}
        {!loading && error === null && (() => {
          const critical = visibleEvents.filter(e => e.status === "active" && e.confidence >= 0.75);
          const moderate = visibleEvents.filter(e => e.status === "active" && e.confidence >= 0.5 && e.confidence < 0.75);
          if (visibleEvents.length === 0 && events.length > 0) return null; // filtered out — don't show banner
          if (critical.length > 0) return (
            <div className="mt-3 flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
              <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-rose-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-rose-800">
                  {critical.length === 1 ? "Critical situation confirmed" : `${critical.length} critical situations confirmed`}
                </p>
                <p className="text-xs text-rose-600 mt-0.5">High-confidence reports. Act on this information now.</p>
              </div>
            </div>
          );
          if (moderate.length > 0) return (
            <div className="mt-3 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <span className="flex-shrink-0 text-amber-500"><IncidentIcon className="w-4 h-4" /></span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Situation under assessment</p>
                <p className="text-xs text-amber-700 mt-0.5">Reports are coming in. Confidence is still building — exercise caution.</p>
              </div>
            </div>
          );
          if (events.length > 0) return (
            <div className="mt-3 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
              <span className="flex-shrink-0 text-emerald-500"><CheckCircleIcon className="w-4 h-4" /></span>
              <div>
                <p className="text-sm font-semibold text-emerald-800">No critical threats detected</p>
                <p className="text-xs text-emerald-700 mt-0.5">Monitored events show low severity. Stay alert and keep reporting.</p>
              </div>
            </div>
          );
          return null;
        })()}

        {/* ── Result count ── */}
        {!loading && error === null && (
          <p className="mt-2.5 text-xs text-slate-400 font-medium px-0.5">
            {visibleEvents.length === 0
              ? "No events match your filter"
              : `${visibleEvents.length} situation${visibleEvents.length !== 1 ? "s" : ""} · last ${timeframeDays === 1 ? "24 hours" : `${timeframeDays} days`}`}
          </p>
        )}

        {/* ── Error banner ── */}
        {error !== null && (
          <div className="mt-4 flex items-center justify-between bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
            <p className="text-sm text-rose-700">
              <span className="font-semibold">Error:</span> {error}
            </p>
            <button
              onClick={() => { setLoading(true); void fetchEvents(); }}
              className="text-xs font-semibold text-rose-700 underline ml-3 flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Background-refresh sweep bar ── */}
        {refreshing && (
          <div className="mt-3 h-0.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-teal-400 rounded-full animate-sweep-bar" />
          </div>
        )}

        {/* ── Event cards ── */}
        <div className={`mt-3 space-y-2.5 transition-opacity duration-300 ${refreshing ? "opacity-75" : "opacity-100"}`}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : visibleEvents.length === 0 && error === null ? (
            events.length > 0 ? (
              // Events exist but filtered out
              <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center text-center">
                <span className="text-slate-300 mb-2"><SearchIcon className="w-8 h-8" /></span>
                <p className="text-sm font-semibold text-slate-700 mb-1">No matches for this filter</p>
                <p className="text-xs text-slate-400">Try "Any" confidence or a different event type.</p>
              </div>
            ) : (
              // No events at all — show mission statement
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-teal-700 px-6 pt-8 pb-6 text-center" >
                  <svg viewBox="0 0 40 40" fill="none" className="w-12 h-12 mx-auto mb-3" aria-hidden="true">
                    <circle cx="20" cy="27" r="3" fill="white" />
                    <path d="M13 21.5 a9 9 0 0 1 14 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M7 16 a16 16 0 0 1 26 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
                  </svg>
                  <h2 className="text-lg font-bold text-white leading-snug">
                    In a crisis, conflicting<br />information kills.
                  </h2>
                  <p className="text-sm text-teal-200 mt-2 leading-relaxed">
                    GroundTruth weighs every report against the others<br />
                    so you know what's actually happening.
                  </p>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-xs text-slate-500 mb-4">
                    No situations reported yet. Be the first to add ground truth.
                  </p>
                  <a
                    href="/report"
                    className="inline-flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Submit your first report
                  </a>
                </div>
              </div>
            )
          ) : (
            visibleEvents.map((event) => (
              <EventCard key={event.id} event={event} isUpdating={changedIds.has(event.id)} />
            ))
          )}
        </div>

        {/* ── Safety Advice ── */}
        <div className="mt-4">
          <ActionAdvisor events={visibleEvents} />
        </div>

        {/* ── Local Mesh ── */}
        <div className="mt-3">
          <MeshStatus isOffline={isOffline} />
        </div>

        {/* ── System identity ── */}
        <p className="mt-6 mb-2 text-center text-[11px] text-slate-400 tracking-wide">
          On-device AI reasoning. Works without internet.
        </p>
      </div>

      {/* ── Click-away for menus ── */}
      {(showFilterMenu || showOverflow) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setShowFilterMenu(false); setShowOverflow(false); }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
