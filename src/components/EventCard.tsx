"use client";

import { useState } from "react";
import type { AssessedEvent, NormalizedSignal } from "@/types";
import ConflictView from "./ConflictView";
import { EventTypeIcon, EvidenceIcon } from "./icons";

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

// Guess evidence type from free-text (for parsed reasoning items)
function guessType(item: string): NormalizedSignal["evidenceType"] {
  if (/sensor/i.test(item)) return "sensor";
  if (/photo|image|visual/i.test(item)) return "photo";
  if (/audio|voice|sound/i.test(item)) return "audio";
  return "text";
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

function getLabel(type: string): string {
  return EVENT_TYPE_LABEL[type] ?? "Incident";
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

// ── Trend badge colour ────────────────────────────────────────────────────────

function trendClass(trend: string) {
  if (/worse|worsening|rising|increasing/i.test(trend))
    return "bg-rose-50 text-rose-700";
  if (/better|improving|receding|decreasing|stable/i.test(trend))
    return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

// Trim trend text to keep the badge inline
function shortTrend(trend: string): string {
  // Strip parenthetical elaborations: "Getting worse (…)" → "Getting worse"
  const stripped = trend.replace(/\s*\(.*?\)/, "").trim();
  return stripped.length > 30 ? stripped.slice(0, 28) + "…" : stripped;
}

// ── Parsed reasoning renderer ─────────────────────────────────────────────────

function ReasoningSection({ parsed }: { parsed: ParsedReasoning }) {
  const [showDetails, setShowDetails] = useState(false);

  const hasFor     = parsed.evidenceFor.length > 0;
  const hasAgainst = parsed.evidenceAgainst.length > 0;
  const hasSections = hasFor || hasAgainst || !!parsed.resolution;

  // No structured sections — fall back to intro text
  if (!hasSections) {
    if (!parsed.intro) return null;
    return <p className="text-xs text-slate-600 leading-relaxed">{parsed.intro}</p>;
  }

  return (
    <div>
      {/* ── Summary row (always visible) ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {hasFor && (
            <span className="text-xs text-slate-600">
              <span className="font-semibold text-emerald-600">{parsed.evidenceFor.length}</span>
              {" "}supporting
            </span>
          )}
          {hasAgainst && (
            <>
              {hasFor && <span className="text-slate-300 text-xs">·</span>}
              <span className="text-xs text-slate-600">
                <span className="font-semibold text-amber-600">{parsed.evidenceAgainst.length}</span>
                {" "}contradicting
              </span>
            </>
          )}
          {parsed.trend && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${trendClass(parsed.trend)}`}>
                {shortTrend(parsed.trend)}
              </span>
            </>
          )}
        </div>

        <button
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex-shrink-0 transition-colors"
        >
          {showDetails ? "Less" : "Details"}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2}
            strokeLinecap="round" strokeLinejoin="round"
            className={`w-3 h-3 transition-transform duration-150 ${showDetails ? "rotate-180" : ""}`}>
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </div>

      {/* ── Detail panel (expandable) ── */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-expand">

          {hasFor && (
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

          {hasAgainst && (
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

          {parsed.resolution && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Conclusion
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{parsed.resolution}</p>
            </div>
          )}

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

  const label       = getLabel(event.eventType);
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
        <span className="flex-shrink-0 w-7 flex items-center justify-center text-slate-500" aria-hidden="true">
          <EventTypeIcon type={event.eventType} className="w-5 h-5" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1">
            {event.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 flex-wrap">
            <StatusDot status={event.status} />
            <span aria-hidden="true">·</span>
            <span>{label}</span>
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
