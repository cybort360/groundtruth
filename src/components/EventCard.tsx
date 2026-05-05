"use client";

import { useState, useEffect } from "react";
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

function getClockTime(iso: string): string {
  const d = new Date(iso);
  // If the date is today, show just HH:MM; otherwise show "May 5, 14:30"
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  // Handles three formats produced by different sources:
  //   1. "; " separated  — AI-generated reasoning chains
  //   2. ". Signal X"    — seeded demo data format
  //   3. Single item     — fallback
  function splitItems(text: string | null): string[] {
    if (!text) return [];
    const trimmed = text.replace(/\.\s*$/, "").trim();

    // Try semicolons first (most common AI output)
    const bySemicolon = trimmed.split(/;\s+/).map((s) => s.trim()).filter(Boolean);
    if (bySemicolon.length > 1) return bySemicolon;

    // Try splitting on ". Signal " — matches seed data like
    // "Signal E (photo…). Signal G (sensor…). Signal C (voice…)"
    const bySignalKeyword = trimmed.split(/\.\s+(?=Signal\s+\w)/i).map((s) => s.trim()).filter(Boolean);
    if (bySignalKeyword.length > 1) return bySignalKeyword;

    // Try splitting on ". " before a capital letter + parenthesis — catches
    // other structured formats without a "Signal" keyword
    const byCapSentence = trimmed.split(/\.\s+(?=[A-Z][^.]{5,}\()/).map((s) => s.trim()).filter(Boolean);
    if (byCapSentence.length > 1) return byCapSentence;

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

function ConfidenceRing({ value, isUpdating }: { value: number; isUpdating?: boolean }) {
  const pct    = Math.round(value * 100);
  const r      = 15;
  const circ   = 2 * Math.PI * r;
  const target = circ * (1 - pct / 100);

  // Animate from empty on mount; also transitions smoothly when value changes.
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const id = setTimeout(() => setOffset(target), 40);
    return () => clearTimeout(id);
  }, [target]);

  // Re-trigger the flash class by toggling a key each time isUpdating fires.
  const [flashKey, setFlashKey] = useState(0);
  useEffect(() => {
    if (isUpdating) setFlashKey((k) => k + 1);
  }, [isUpdating]);

  const stroke =
    pct >= 90 ? "#0d9488"
    : pct >= 70 ? "#0d9488"
    : pct >= 50 ? "#f59e0b"
    : "#f43f5e";

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36" aria-label={`Confidence: ${pct}%`}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeDasharray={circ.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.65s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <span
        key={flashKey}
        className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-800 leading-none${isUpdating ? " confidence-updated" : ""}`}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Confidence label ──────────────────────────────────────────────────────────

function confidenceLabel(value: number): { text: string; color: string } {
  if (value >= 0.90) return { text: "Very High Confidence", color: "text-teal-600"  };
  if (value >= 0.70) return { text: "High Confidence",      color: "text-teal-600"  };
  if (value >= 0.50) return { text: "Uncertain",            color: "text-amber-600" };
  return                     { text: "Low Confidence",      color: "text-slate-400" };
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

// ── Severity helpers ──────────────────────────────────────────────────────────

/**
 * Credibility-weighted mean of signal severities, rounded to nearest integer.
 * Higher-credibility signals pull the score more strongly, so a single
 * low-credibility outlier doesn't distort the event's overall picture.
 */
function deriveSeverity(signals: NormalizedSignal[]): number | null {
  if (signals.length === 0) return null;
  const totalWeight = signals.reduce((s, sig) => s + sig.credibilityScore, 0);
  if (totalWeight === 0) return null;
  const weighted = signals.reduce((s, sig) => s + sig.severity * sig.credibilityScore, 0);
  return Math.min(5, Math.max(1, Math.round(weighted / totalWeight)));
}

interface SeverityCfg {
  label: string;
  pill:  string;   // bg + text for the badge
  dot:   string;   // dot fill
}

const SEVERITY_CFG: Record<number, SeverityCfg> = {
  1: { label: "Minimal",  pill: "bg-slate-100 text-slate-500",  dot: "bg-slate-400"  },
  2: { label: "Low",      pill: "bg-green-50 text-green-700",   dot: "bg-green-500"  },
  3: { label: "Moderate", pill: "bg-amber-50 text-amber-700",   dot: "bg-amber-400"  },
  4: { label: "High",     pill: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  5: { label: "Critical", pill: "bg-rose-50 text-rose-700",     dot: "bg-rose-500"   },
};

function SeverityBadge({ severity }: { severity: number | null }) {
  if (severity === null) return null;
  const cfg = SEVERITY_CFG[severity] ?? SEVERITY_CFG[3];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
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

// ── Assessment summary sentence ───────────────────────────────────────────────

const EVIDENCE_LABEL: Record<string, string> = {
  photo:  "photo",
  sensor: "sensor",
  audio:  "voice report",
  text:   "text report",
};

function buildSummaryLine(
  parsed: ParsedReasoning,
  signals: NormalizedSignal[],
  eventType: string
): string | null {
  const now = Date.now();
  const eventNoun = (EVENT_TYPE_LABEL[eventType] ?? "incident").toLowerCase();

  // Prefer structured signal data for evidence types + timing
  if (signals.length > 0) {
    const supporting   = signals.filter((s) => s.credibilityScore >= 0.5)
                                .sort((a, b) => b.credibilityScore - a.credibilityScore);
    const conflicting  = signals.filter((s) => s.credibilityScore < 0.4);

    if (supporting.length === 0) return null;

    // Collect up to 2 distinct evidence types from top supporters
    const types: string[] = [];
    for (const sig of supporting) {
      if (!types.includes(sig.evidenceType)) types.push(sig.evidenceType);
      if (types.length === 2) break;
    }

    const latestSupport  = Math.max(...supporting.map((s) => new Date(s.timestamp).getTime()));
    const recentThreshMs = 90 * 60 * 1000; // 90 min
    const isRecent       = now - latestSupport < recentThreshMs;

    const typeStr  = types.map((t) => EVIDENCE_LABEL[t] ?? t).join(" + ");
    // "photo + sensor confirm" (plural subject) vs "sensor data confirms" (singular)
    const verb     = types.length === 1 && !typeStr.includes("report") ? "confirms" : "confirm";
    let line = `${isRecent ? "Recent " : ""}${typeStr} ${verb} ${eventNoun}.`;

    if (conflicting.length > 0) {
      const latestConflict = Math.max(...conflicting.map((s) => new Date(s.timestamp).getTime()));
      const isOlder = latestConflict < latestSupport;
      const n       = conflicting.length === 1 ? "One" : String(conflicting.length);
      line += ` ${n}${isOlder ? " older" : ""} report${conflicting.length !== 1 ? "s" : ""} conflict${conflicting.length === 1 ? "s" : ""}.`;
    }

    return line;
  }

  // Fallback: derive from parsed counts alone
  const forCount     = parsed.evidenceFor.length;
  const againstCount = parsed.evidenceAgainst.length;
  if (forCount === 0) return null;

  let line = `${forCount} source${forCount !== 1 ? "s" : ""} support${forCount === 1 ? "s" : ""} this ${eventNoun} assessment.`;
  if (againstCount > 0)
    line += ` ${againstCount} conflict${againstCount === 1 ? "s" : ""}.`;
  return line;
}

// ── Parsed reasoning renderer ─────────────────────────────────────────────────

function ReasoningSection({
  parsed,
  signals,
  eventType,
}: {
  parsed: ParsedReasoning;
  signals: NormalizedSignal[];
  eventType: string;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const hasFor      = parsed.evidenceFor.length > 0;
  const hasAgainst  = parsed.evidenceAgainst.length > 0;
  const hasSections = hasFor || hasAgainst || !!parsed.resolution;

  const summaryLine = buildSummaryLine(parsed, signals, eventType);

  // No structured sections — fall back to intro text
  if (!hasSections) {
    if (!parsed.intro && !summaryLine) return null;
    return <p className="text-xs text-slate-600 leading-relaxed">{summaryLine ?? parsed.intro}</p>;
  }

  return (
    <div>
      {/* ── Plain-English summary (always visible) ── */}
      {summaryLine && (
        <p className="text-sm text-slate-700 font-medium leading-snug mb-2.5">
          {summaryLine}
        </p>
      )}

      {/* ── Counts + trend + toggle (always visible) ── */}
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

// ── Routing badge ─────────────────────────────────────────────────────────────

function RoutingBadge({ assessedBy }: { assessedBy?: AssessedEvent["assessedBy"] }) {
  if (assessedBy === "cloud") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full border border-violet-100">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
        Cloud AI · Gemma 27B
      </span>
    );
  }
  if (assessedBy === "local-fallback") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
        Heuristic estimate
      </span>
    );
  }
  // "local" or undefined — default, shown to make the contrast clear in demos
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full border border-teal-100">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      Local AI · E4B
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventCard({ event, isUpdating }: { event: AssessedEvent; isUpdating?: boolean }) {
  const [expanded, setExpanded]           = useState(false);
  const [showSignals, setShowSignals]     = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showThinking, setShowThinking]   = useState(false);
  const [thinkExpanded, setThinkExpanded] = useState(false);

  const label       = getLabel(event.eventType);
  const signalCount = event.signals?.length ?? event.signalCount;
  const parsed      = parseReasoning(event.reasoningChain);
  const severity    = deriveSeverity(event.signals ?? []);
  const severityCfg = severity !== null ? (SEVERITY_CFG[severity] ?? SEVERITY_CFG[3]) : null;

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
            {severity !== null && (
              <>
                <span aria-hidden="true">·</span>
                <SeverityBadge severity={severity} />
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{signalCount} report{signalCount !== 1 ? "s" : ""}</span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium ${confidenceLabel(event.confidence).color}`}>
              {confidenceLabel(event.confidence).text}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            Updated {getRelativeTime(event.lastUpdated)}
          </p>
        </div>

        <ConfidenceRing value={event.confidence} isUpdating={isUpdating} />
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="animate-expand px-4 pb-4 pt-3 border-t border-slate-100 space-y-3">

          {/* Severity indicator */}
          {severity !== null && (
            <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${severityCfg?.pill ?? ""}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severityCfg?.dot ?? ""}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight">
                  Severity {severity}/5 — {severityCfg?.label}
                </p>
                <p className="text-[11px] opacity-80 leading-tight mt-0.5">
                  {severity === 5 && "Extreme danger — life-threatening conditions reported."}
                  {severity === 4 && "Serious hazard — avoid the affected area."}
                  {severity === 3 && "Moderate risk — proceed with caution."}
                  {severity === 2 && "Minor impact — conditions manageable with care."}
                  {severity === 1 && "Negligible impact — low risk to movement or safety."}
                </p>
              </div>
            </div>
          )}

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

          {/* Assessment */}
          <div className="bg-slate-50 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Assessment
              </p>
              <RoutingBadge assessedBy={event.assessedBy} />
            </div>
            <ReasoningSection
              parsed={parsed}
              signals={event.signals ?? []}
              eventType={event.eventType}
            />

            {/* Gemma 4 thinking trace — shown when present */}
            {event.thinkingTrace && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <button
                  onClick={() => setShowThinking((v) => !v)}
                  className="flex items-center gap-2 text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors w-full text-left"
                >
                  {/* Brain / thinking icon */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                    strokeLinecap="round" strokeLinejoin="round"
                    className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true">
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                  </svg>
                  <span>Gemma 4 Thinking Process</span>
                  <span className="text-violet-400 text-[10px] ml-auto">{showThinking ? "▲ hide" : "▼ show"}</span>
                </button>

                {showThinking && (
                  <div className="mt-2 animate-expand">
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 relative overflow-hidden">
                      {/* Token badge */}
                      <span className="absolute top-2 right-2 text-[9px] font-mono font-bold text-violet-400 bg-violet-100 px-1.5 py-0.5 rounded">
                        &lt;|think|&gt;
                      </span>
                      <p
                        className={`text-[11px] font-mono text-violet-800 leading-relaxed whitespace-pre-wrap break-words ${
                          thinkExpanded ? "" : "line-clamp-6"
                        }`}
                      >
                        {event.thinkingTrace}
                      </p>
                      {event.thinkingTrace.length > 400 && (
                        <button
                          onClick={() => setThinkExpanded((v) => !v)}
                          className="mt-1.5 text-[10px] font-semibold text-violet-500 hover:text-violet-700 transition-colors"
                        >
                          {thinkExpanded ? "Show less ▲" : "Show full trace ▼"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* First reported (update time already shown on the compact row) */}
          <p className="text-[11px] text-slate-400 px-0.5" title={new Date(event.firstReported).toLocaleString()}>
            First reported {getClockTime(event.firstReported)} ({getRelativeTime(event.firstReported)})
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
                      className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1"
                    >
                      {/* Time + credibility row */}
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[11px] font-semibold text-slate-600 tabular-nums"
                          title={new Date(signal.timestamp).toLocaleString()}
                        >
                          {getClockTime(signal.timestamp)}
                        </span>
                        <span className="text-slate-300 text-[10px] tabular-nums">
                          ({getRelativeTime(signal.timestamp)})
                        </span>
                        <span className="text-slate-300 text-xs" aria-hidden="true">·</span>
                        <span className="text-slate-400 text-[11px] capitalize">
                          {signal.evidenceType}
                        </span>
                        <span className="ml-auto bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                          {Math.round(signal.credibilityScore * 100)}%
                        </span>
                      </div>
                      {/* Claim */}
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 text-slate-400">
                          <EvidenceIcon type={signal.evidenceType} />
                        </span>
                        <span className="text-xs text-slate-700 leading-relaxed">
                          {signal.claim}
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
