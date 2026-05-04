"use client";

import { useState } from "react";
import type { AssessedEvent, NormalizedSignal } from "@/types";
import ConflictView from "./ConflictView";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const EVENT_TYPE_META: Record<string, { icon: string; label: string }> = {
  flooding:          { icon: "🌊", label: "Flooding" },
  earthquake:        { icon: "🏚️", label: "Earthquake" },
  wildfire:          { icon: "🔥", label: "Wildfire" },
  landslide:         { icon: "⛰️", label: "Landslide" },
  tsunami:           { icon: "🌊", label: "Tsunami" },
  tropical_storm:    { icon: "🌀", label: "Tropical Storm" },
  road_closure:      { icon: "🚧", label: "Road Closure" },
  power_outage:      { icon: "⚡", label: "Power Outage" },
  structural_damage: { icon: "🏗️", label: "Structural Damage" },
  gas_leak:          { icon: "💨", label: "Gas Leak" },
  avalanche:         { icon: "🏔️", label: "Avalanche" },
  volcanic_activity: { icon: "🌋", label: "Volcanic Activity" },
  other:             { icon: "⚠️", label: "Incident" },
};

function getMeta(type: string) {
  return EVENT_TYPE_META[type] ?? EVENT_TYPE_META.other;
}

function evidenceIcon(t: NormalizedSignal["evidenceType"]) {
  return { photo: "📷", audio: "🎤", text: "📝", sensor: "📡" }[t] ?? "📌";
}

// ── Confidence ring (the "surprise" element) ─────────────────────────────────
// A thin SVG arc that fills proportionally to confidence.
// Color shifts: teal (high) → amber (mid) → rose (low).

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const r = 15;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  // High confidence: teal. Mid: amber. Low: rose.
  const stroke =
    pct >= 75 ? "#0d9488"   // teal-600
    : pct >= 50 ? "#f59e0b" // amber-400
    : "#f43f5e";             // rose-500

  // Pulse only on high-severity (low confidence = uncertain, high = alarming)
  const shouldPulse = pct >= 75;

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg
        className={`w-10 h-10 -rotate-90 ${shouldPulse ? "ring-pulse" : ""}`}
        viewBox="0 0 36 36"
        aria-label={`Confidence: ${pct}%`}
      >
        {/* Track */}
        <circle
          cx="18" cy="18" r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="3"
        />
        {/* Fill */}
        <circle
          cx="18" cy="18" r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeDasharray={`${circ.toFixed(2)}`}
          strokeDashoffset={`${offset.toFixed(2)}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-800 leading-none">
        {pct}%
      </span>
    </div>
  );
}

// ── Severity ring colour (used inside the confidence ring SVG) ────────────────
// No external border — severity is communicated entirely by the ring colour.

// ── Confidence label ──────────────────────────────────────────────────────────

function confidenceLabel(value: number): { text: string; color: string } {
  if (value >= 0.80) return { text: "High certainty", color: "text-teal-600" };
  if (value >= 0.60) return { text: "Likely",         color: "text-amber-600" };
  return                     { text: "Uncertain",      color: "text-slate-400" };
}

// ── Bottom line extractor ─────────────────────────────────────────────────────
// Pulls the Recommendation line out of the reasoning chain so it surfaces first.

function extractRecommendation(reasoning: string): string | null {
  const match = reasoning.match(/Recommendation[:\s]+([^\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AssessedEvent["status"] }) {
  const dot =
    status === "active"   ? "bg-emerald-500" :
    status === "resolved" ? "bg-slate-400"   :
                            "bg-amber-400";
  const label =
    status === "active"   ? "Active"    :
    status === "resolved" ? "Resolved"  :
                            "Uncertain";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventCard({ event }: { event: AssessedEvent }) {
  const [expanded, setExpanded]         = useState(false);
  const [showSignals, setShowSignals]   = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);

  const meta        = getMeta(event.eventType);
  const signalCount = event.signals?.length ?? event.signalCount;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* ── Compact row (always visible) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        {/* Event type emoji */}
        <span className="text-xl leading-none flex-shrink-0 w-7 text-center" aria-hidden="true">
          {meta.icon}
        </span>

        {/* Title + meta row */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1">
            {event.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 flex-wrap">
            <StatusDot status={event.status} />
            <span aria-hidden="true">·</span>
            <span>{meta.label}</span>
            <span aria-hidden="true">·</span>
            <span>{signalCount} report{signalCount !== 1 ? "s" : ""}</span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium ${confidenceLabel(event.confidence).color}`}>
              {confidenceLabel(event.confidence).text}
            </span>
          </div>
        </div>

        {/* Confidence ring */}
        <ConfidenceRing value={event.confidence} />
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="animate-expand px-4 pb-4 pt-3 border-t border-slate-100 space-y-3">

          {/* Bottom line — most actionable sentence first */}
          {extractRecommendation(event.reasoningChain) && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-3.5 py-3">
              <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider mb-1">
                What to do
              </p>
              <p className="text-sm font-medium text-teal-900 leading-snug">
                {extractRecommendation(event.reasoningChain)}
              </p>
            </div>
          )}

          {/* Full reasoning */}
          <div className="bg-slate-50 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              How the AI decided
            </p>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
              {event.reasoningChain}
            </p>
          </div>

          {/* Conflicts */}
          {event.conflicts.length > 0 && (
            <div>
              <button
                onClick={() => setShowConflicts((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full px-3 py-1.5 transition-colors"
              >
                <span>⚠</span>
                {event.conflicts.length} conflicting report{event.conflicts.length !== 1 ? "s" : ""}
                <span className="text-amber-400">{showConflicts ? "▲" : "▼"}</span>
              </button>
              {showConflicts && (
                <div className="mt-2 animate-expand">
                  <ConflictView conflicts={event.conflicts} />
                </div>
              )}
            </div>
          )}

          {/* Contributing signals */}
          {signalCount > 0 && (
            <div>
              <button
                onClick={() => setShowSignals((v) => !v)}
                className="text-xs font-medium text-slate-500 hover:text-teal-600 transition-colors"
              >
                {showSignals ? "▲ Hide" : "▼ Show"} {signalCount} contributing report{signalCount !== 1 ? "s" : ""}
              </button>

              {showSignals && event.signals.length > 0 && (
                <ul className="mt-2 space-y-1.5 animate-expand">
                  {event.signals.map((signal) => (
                    <li
                      key={signal.id}
                      className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 rounded-xl px-3 py-2"
                    >
                      <span className="shrink-0 mt-0.5" aria-label={signal.evidenceType}>
                        {evidenceIcon(signal.evidenceType)}
                      </span>
                      <span className="flex-1 leading-relaxed">{signal.claim}</span>
                      <span className="shrink-0 bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5 font-semibold tabular-nums">
                        {Math.round(signal.credibilityScore * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
