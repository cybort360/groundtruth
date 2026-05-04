"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EventCard from "@/components/EventCard";
import MapViewLoader from "@/components/MapViewLoader";
import ActionAdvisor from "@/components/ActionAdvisor";
import MeshStatus from "@/components/MeshStatus";
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
  { value: "flooding",          icon: "🌊", label: "Flooding" },
  { value: "earthquake",        icon: "🏚️", label: "Earthquake" },
  { value: "wildfire",          icon: "🔥", label: "Wildfire" },
  { value: "landslide",         icon: "⛰️", label: "Landslide" },
  { value: "tsunami",           icon: "🌊", label: "Tsunami" },
  { value: "tropical_storm",    icon: "🌀", label: "Storm" },
  { value: "road_closure",      icon: "🚧", label: "Road" },
  { value: "power_outage",      icon: "⚡", label: "Power" },
  { value: "structural_damage", icon: "🏗️", label: "Structure" },
  { value: "gas_leak",          icon: "💨", label: "Gas Leak" },
  { value: "avalanche",         icon: "🏔️", label: "Avalanche" },
  { value: "volcanic_activity", icon: "🌋", label: "Volcano" },
  { value: "other",             icon: "⚠️", label: "Other" },
] as const;

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [events, setEvents]                     = useState<AssessedEvent[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]           = useState<string | null>(null);
  const [filterType, setFilterType]             = useState<string>("all");
  const [minConfidence, setMinConfidence]       = useState<number>(0);
  const [sortOrder, setSortOrder]               = useState<"confidence" | "recency">("confidence");
  const [showSortMenu, setShowSortMenu]         = useState(false);
  const { isOffline, ollamaReachable }          = useOffline();
  const intervalRef                             = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = (await res.json()) as { events: AssessedEvent[]; lastUpdated: string };
      setEvents(data.events);
      setLastUpdated(data.lastUpdated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
    intervalRef.current = setInterval(() => void fetchEvents(), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchEvents]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const typeCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
    return acc;
  }, {});

  const visibleEvents = events
    .filter((e) => filterType === "all" || e.eventType === filterType)
    .filter((e) => e.confidence * 100 >= minConfidence)
    .sort((a, b) =>
      sortOrder === "confidence"
        ? b.confidence - a.confidence
        : new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

  const hasEvents = !loading && error === null && events.length > 0;

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
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Refresh */}
            <button
              onClick={() => { setLoading(true); void fetchEvents(); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Refresh"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            {/* Settings */}
            <a
              href="/settings"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </a>
            {/* Submit report */}
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

        {/* ── Map strip ── */}
        <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 280 }}>
          <MapViewLoader events={visibleEvents} />
        </div>

        {/* ── Filter + sort bar ── */}
        <div className="mt-4 flex items-center gap-2">
          {/* Horizontally scrollable type pills */}
          <div className="flex-1 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 w-max pr-2">
              {/* All pill */}
              <button
                onClick={() => setFilterType("all")}
                className={`
                  flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors
                  ${filterType === "all"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-teal-300"}
                `}
              >
                All
                {hasEvents && (
                  <span className={`ml-1 ${filterType === "all" ? "text-teal-200" : "text-slate-400"}`}>
                    {events.length}
                  </span>
                )}
              </button>

              {/* All 13 type pills — types with events are vivid, empty ones fade back */}
              {ALL_EVENT_TYPES.map(({ value, icon, label }) => {
                const count = typeCounts[value] ?? 0;
                const active = filterType === value;
                const hasData = count > 0;

                return (
                  <button
                    key={value}
                    onClick={() => setFilterType(value)}
                    className={`
                      flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all
                      ${active
                        ? "bg-teal-600 text-white shadow-sm"
                        : hasData
                          ? "bg-white text-slate-600 border border-slate-200 hover:border-teal-300"
                          : "bg-white text-slate-400 border border-slate-100 hover:border-slate-300 opacity-60"}
                    `}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                    {hasData && (
                      <span className={active ? "text-teal-200" : "text-slate-400"}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 hover:border-teal-300 transition-colors"
              aria-label="Sort events"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {sortOrder === "confidence" ? "Confidence" : "Recent"}
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20 min-w-[140px]">
                {(["confidence", "recency"] as const).map((val) => (
                  <button
                    key={val}
                    onClick={() => { setSortOrder(val); setShowSortMenu(false); }}
                    className={`
                      w-full text-left text-xs px-3 py-2.5 transition-colors
                      ${sortOrder === val
                        ? "bg-teal-50 text-teal-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50"}
                    `}
                  >
                    {val === "confidence" ? "By confidence" : "By recency"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Confidence threshold pills ── */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 flex-shrink-0">Min confidence</span>
          <div className="flex items-center gap-1">
            {([0, 50, 75, 90] as const).map((threshold) => {
              const active = minConfidence === threshold;
              return (
                <button
                  key={threshold}
                  onClick={() => setMinConfidence(threshold)}
                  className={`
                    text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all
                    ${active
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-white text-slate-500 border border-slate-200 hover:border-teal-300"}
                  `}
                >
                  {threshold === 0 ? "Any" : `${threshold}%+`}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Status banner ── */}
        {!loading && error === null && (() => {
          const critical = visibleEvents.filter(e => e.status === "active" && e.confidence >= 0.75);
          const moderate = visibleEvents.filter(e => e.status === "active" && e.confidence >= 0.5 && e.confidence < 0.75);
          if (visibleEvents.length === 0 && events.length > 0) return null; // filtered out — don't show banner
          if (critical.length > 0) return (
            <div className="mt-3 flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
              <span className="text-base flex-shrink-0">🔴</span>
              <div>
                <p className="text-sm font-semibold text-rose-800">
                  {critical.length === 1 ? "Critical situation confirmed" : `${critical.length} critical situations confirmed`}
                </p>
                <p className="text-xs text-rose-600 mt-0.5">High-confidence reports — act on this information now.</p>
              </div>
            </div>
          );
          if (moderate.length > 0) return (
            <div className="mt-3 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <span className="text-base flex-shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Situation under assessment</p>
                <p className="text-xs text-amber-700 mt-0.5">Reports are coming in. Confidence is still building — exercise caution.</p>
              </div>
            </div>
          );
          if (events.length > 0) return (
            <div className="mt-3 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
              <span className="text-base flex-shrink-0">✅</span>
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
              : `${visibleEvents.length} situation${visibleEvents.length !== 1 ? "s" : ""} assessed`}
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

        {/* ── Event cards ── */}
        <div className="mt-3 space-y-2.5">
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
                <span className="text-2xl mb-2">🔍</span>
                <p className="text-sm font-semibold text-slate-700 mb-1">No matches for this filter</p>
                <p className="text-xs text-slate-400">Try "Any" confidence or a different event type.</p>
              </div>
            ) : (
              // No events at all — show mission statement
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-teal-700 px-6 pt-8 pb-6 text-center">
                  <svg viewBox="0 0 40 40" fill="none" className="w-12 h-12 mx-auto mb-3" aria-hidden="true">
                    <circle cx="20" cy="27" r="3" fill="white" />
                    <path d="M13 21.5 a9 9 0 0 1 14 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M7 16 a16 16 0 0 1 26 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
                  </svg>
                  <h2 className="text-lg font-bold text-white leading-snug">
                    In a crisis, conflicting<br />information kills.
                  </h2>
                  <p className="text-sm text-teal-200 mt-2 leading-relaxed">
                    GroundTruth weighs every report against the others —<br />
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
              <EventCard key={event.id} event={event} />
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
      </div>

      {/* ── Click-away for sort menu ── */}
      {showSortMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowSortMenu(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
