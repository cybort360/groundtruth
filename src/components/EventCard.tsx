"use client";

import { useState } from "react";
import type { AssessedEvent, NormalizedSignal } from "@/types";
import ConflictView from "./ConflictView";

// ── Time helpers ──────────────────────────────────────────────────────────────

function getRelativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${Math.floor((mins % 60))}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Replace ISO 8601 timestamps embedded in reasoning text with "HH:MM" local time
function localizeTimestamps(text: string): string {
  return text.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
    (iso) => {
      try {
        return new Date(iso).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return iso;
      }
    }
  );
}

// ── Reasoning chain parser ────────────────────────────────────────────────────

interface ParsedReasoning {
  intro: string | null;
  evidenceFor: string[];
  evidenceAgainst: string[];
  resolution: string | null;
  trend: string | null;
  recommendation: string | null;
}

function parseReasoning(raw: string): ParsedReasoning {
  // Localize all embedded ISO timestamps before parsing
  const chain = localizeTimestamps(raw);

  function extract(pattern: RegExp): string | null {
    const m = chain.match(pattern);
    return m ? m[1].replace(/\.\s*$/, "").trim() : null;
  }

  // Split evidence section into individual items.
  // AI-generated format uses "; " as separator; seed data uses ", ".
  // We try semicolons first, then fall back to the whole string as one item.
  function splitItems(text: string | null): string[] {
    if (!text) return [];
    const trimmed = text.replace(/\.\s*$/, "").trim();
    const bySemicolon = trimmed.split(/;\s+/).map((s) => s.trim()).filter(Boolean);
    if (bySemicolon.length > 1) return bySemicolon;
    return [trimmed];
  }

  const forText = extract(
    /Evidence for[:\s]+([\s\S]+?)(?=Evidence against|Resolution|Trend|Recommendation|\n\n|$)/i
  );
  const againstText = extract(
    /Evidence against[:\s]+([\s\S]+?)(?=Resolution|Trend|Recommendation|\n\n|$)/i
  );
  const resolution = extract(
    /Resolution[:\s]+([\s\S]+?)(?=Trend|Recommendation|\n\n|$)/i
  );
  const trend = extract(/Trend[:\s]+([\s\S]+?)(?=Recommendation|\n\n|$)/i);
  const recommendation = extract(/Recommendation[:\s]+([\s\S]+?)(?=\n\n|$)/i);

  // Intro = anything before the first recognized section keyword
  const introMatch = chain.match(
    /^([\s\S]+?)(?=Evidence for|Evidence against|Resolution|Trend|Recommendation)/i
  );
  const rawIntro = introMatch
    ? introMatch[1].replace(/\n+/g, " ").trim()
    : null;

  // Suppress intro if it's just "Title — 0.93" (already in the card header)
  const isRedundantIntro =
    rawIntro != null && /^.+\s[—–-]\s*\d+\.\d+$/.test(rawIntro.trim());
  const intro = rawIntro && rawIntro.length > 3 && !isRedundantIntro ? rawIntro : null;

  return {
    intro,
    evidenceFor: splitItems(forText),
    evidenceAgainst: splitItems(againstText),
    resolution,
    trend,
    recommendation,
  };
}

// ── Evidence type icon (SVG) ──────────────────────────────────────────────────

function EvidenceIcon({
  type,
  className = "w-3.5 h-3.5",
}: {
  type: NormalizedSignal["evidenceType"];
  className?: string;
}) {
  const base = `${className} flex-shrink-0`;
  if (type === "photo")
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={base}>
        <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h.879a1.5 1.5 0 0 0 1.06-.44l.883-.883A1.5 1.5 0 0 1 7.38 4h5.243a1.5 1.5 0 0 1 1.06.44l.883.883A1.5 1.5 0 0 0 15.62 6H16.5A1.5 1.5 0 0 1 18 7.5v8A1.5 1.5 0 0 1 16.5 17h-13A1.5 1.5 0 0 1 2 15.5v-8z" />
        <circle cx="10" cy="11" r="2.5" />
      </svg>
    );
  if (type === "audio")
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={base}>
        <rect x="7" y="2" width="6" height="9" rx="3" />
        <path d="M4 10a6 6 0 0 0 12 0M10 16v2M7 18h6" />
      </svg>
    );
  if (type === "sensor")
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={base}>
        <path d="M3.5 6.5a9 9 0 0 0 0 7M6 8.5a5 5 0 0 0 0 3M16.5 6.5a9 9 0 0 1 0 7M14 8.5a5 5 0 0 1 0 3" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  // text
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={base}>
      <path d="M4 6h12M4 10h8M4 14h6" />
    </svg>
  );
}

// Guess evidence type from free-text (for parsed reasoning items)
function guessType(item: string): NormalizedSignal["evidenceType"] {
  if (/sensor/i.test(item)) return "sensor";
  if (/photo|image|visual/i.test(item)) return "photo";
  if (/audio|voice|sound/i.test(item)) return "audio";
  return "text";
}

// ── Event type metadata ───────────────────────────────────────────────────────

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

// ── Confidence ring ───────────────────────────────────────────────────────────

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const r = 15;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  const stroke =
    pct >= 75 ? "#0d9488"
    : pct >= 50 ? "#f59e0b"
    : "#f43f5e";

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg
        className="w-10 h-10 -rotate-90"
        viewBox="0 0 36 36"
        aria-label={`Confidence: ${pct}%`}
      >
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
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

// ── Confidence label ──────────────────────────────────────────────────────────

function confidenceLabel(value: number): { text: string; color: string } {
  if (value >= 0.80) return { text: "High certainty", color: "text-teal-600" };
  if (value >= 0.60) return { text: "Likely",          color: "text-amber-600" };
  return                     { text: "Uncertain",       color: "text-slate-400" };
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AssessedEvent["status"] }) {
  const dot =
    status === "active"   ? "bg-emerald-500" :
    status === "resolved" ? "bg-slate-400"   :
                            "bg-amber-400";
  const label =
    status === "active"   ? "Active"   :
    status === "resolved" ? "Resolved" :
                            "Uncertain";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}

// ── Parsed reasoning renderer ─────────────────────────────────────────────────

function ReasoningSection({ parsed }: { parsed: ParsedReasoning }) {
  const hasSections =
    parsed.evidenceFor.length > 0 ||
    parsed.evidenceAgainst.length > 0 ||
    parsed.resolution;

  // Fallback: render the intro text if nothing parsed out
  if (!hasSections && parsed.intro) {
    return (
      <p className="text-xs text-slate-600 leading-relaxed">{parsed.intro}</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Intro / summary line */}
      {parsed.intro && (
        <p className="text-xs text-slate-500 leading-relaxed">{parsed.intro}</p>
      )}

      {/* Evidence for */}
      {parsed.evidenceFor.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">
            Supporting
          </p>
          <ul className="space-y-1.5">
            {parsed.evidenceFor.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-500">
                  <EvidenceIcon type={guessType(item)} />
                </span>
                <span className="text-xs text-slate-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence against */}
      {parsed.evidenceAgainst.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">
            Contradicting
          </p>
          <ul className="space-y-1.5">
            {parsed.evidenceAgainst.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-500">
                  <EvidenceIcon type={guessType(item)} />
                </span>
                <span className="text-xs text-slate-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resolution */}
      {parsed.resolution && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Conclusion
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">{parsed.resolution}</p>
        </div>
      )}

      {/* Trend badge */}
      {parsed.trend && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Trend
          </span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              /worse|worsening|rising|increasing/i.test(parsed.trend)
                ? "bg-rose-50 text-rose-700"
                : /better|improving|receding|decreasing|stable/i.test(parsed.trend)
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {parsed.trend}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventCard({ event }: { event: AssessedEvent }) {
  const [expanded, setExpanded]           = useState(false);
  const [showSignals, setShowSignals]     = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);

  const meta        = getMeta(event.eventType);
  const signalCount = event.signals?.length ?? event.signalCount;
  const parsed      = parseReasoning(event.reasoningChain);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md">

      {/* ── Compact row (always visible) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        <span className="text-xl leading-none flex-shrink-0 w-7 text-center" aria-hidden="true">
          {meta.icon}
        </span>

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

        <ConfidenceRing value={event.confidence} />
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="animate-expand px-4 pb-4 pt-3 border-t border-slate-100 space-y-3">

          {/* What to do — recommendation first, most actionable */}
          {parsed.recommendation && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-3.5 py-3">
              <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider mb-1">
                What to do
              </p>
              <p className="text-sm font-medium text-teal-900 leading-snug">
                {parsed.recommendation}
              </p>
            </div>
          )}

          {/* Assessment — replaces "How the AI decided" */}
          <div className="bg-slate-50 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Assessment
            </p>
            <ReasoningSection parsed={parsed} />
          </div>

          {/* Last updated */}
          <p className="text-[11px] text-slate-400 px-0.5">
            Updated {getRelativeTime(event.lastUpdated)}
            {" · "}first reported {getRelativeTime(event.firstReported)}
          </p>

          {/* Conflicts */}
          {event.conflicts.length > 0 && (
            <div>
              <button
                onClick={() => setShowConflicts((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full px-3 py-1.5 transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                  className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M8 2.5v5M8 10.5v.5" />
                  <path d="M2.5 13.5h11L8 2.5 2.5 13.5z" />
                </svg>
                {event.conflicts.length} conflicting report{event.conflicts.length !== 1 ? "s" : ""}
                <span className="text-amber-400 text-[10px]">{showConflicts ? "▲" : "▼"}</span>
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
                      className="flex items-start gap-2 bg-slate-50 rounded-xl px-3 py-2.5"
                    >
                      <span className="shrink-0 mt-0.5 text-slate-400">
                        <EvidenceIcon type={signal.evidenceType} />
                      </span>
                      <span className="flex-1 text-xs text-slate-700 leading-relaxed">
                        {signal.claim}
                      </span>
                      <div className="shrink-0 flex flex-col items-end gap-0.5 pl-1">
                        <span className="bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                          {Math.round(signal.credibilityScore * 100)}%
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                          {getRelativeTime(signal.timestamp)}
                        </span>
                      </div>
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
