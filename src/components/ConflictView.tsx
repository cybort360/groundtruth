import type { ConflictPair, NormalizedSignal } from "@/types";
import { EvidenceIcon } from "./icons";

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

function credibilityColor(score: number): string {
  if (score >= 0.6) return "text-emerald-600";
  if (score >= 0.4) return "text-amber-600";
  return "text-rose-600";
}

function conflictTypeLabel(type: ConflictPair["conflictType"]): string {
  switch (type) {
    case "contradictory_claims":   return "Reports contradict each other";
    case "inconsistent_severity":  return "Severity conflict";
    case "temporal_disagreement":  return "Reports disagree on timing";
    default:                       return "Conflict";
  }
}

// ── Single signal row ─────────────────────────────────────────────────────────

function SignalRow({
  signal,
  accent,
}: {
  signal: NormalizedSignal;
  accent: "teal" | "amber";
}) {
  const pct = Math.round(signal.credibilityScore * 100);
  const iconColor  = accent === "teal" ? "text-teal-600"  : "text-amber-600";
  const labelColor = accent === "teal" ? "text-teal-700"  : "text-amber-700";
  const bg         = accent === "teal" ? "bg-teal-50 border-teal-200"
                                       : "bg-amber-50 border-amber-200";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${bg}`}>
      {/* Meta row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={iconColor}>
            <EvidenceIcon type={signal.evidenceType} className="w-3.5 h-3.5" />
          </span>
          <span className={`text-[11px] font-semibold capitalize ${labelColor}`}>
            {signal.evidenceType === "audio" ? "voice" : signal.evidenceType}
          </span>
          <span className="text-slate-300 text-xs">·</span>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {getRelativeTime(signal.timestamp)}
          </span>
          {signal.isFirsthand && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-[11px] text-emerald-600 font-medium">Firsthand</span>
            </>
          )}
        </div>
        <span className={`text-xs font-bold tabular-nums flex-shrink-0 ml-2 ${credibilityColor(signal.credibilityScore)}`}>
          {pct}%
        </span>
      </div>

      {/* Claim */}
      <p className="text-xs text-slate-700 leading-relaxed">{signal.claim}</p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ConflictViewProps {
  conflicts: ConflictPair[];
  eventTitle?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConflictView({ conflicts }: ConflictViewProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-4">
      {conflicts.map((conflict, index) => (
        <div
          key={`${conflict.signalA.id}-${conflict.signalB.id}`}
          className={index > 0 ? "pt-4 border-t border-slate-100" : undefined}
        >
          {/* Conflict type label */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            {conflictTypeLabel(conflict.conflictType)}
            {conflicts.length > 1 && ` · ${index + 1} of ${conflicts.length}`}
          </p>

          {/* Signal A */}
          <SignalRow signal={conflict.signalA} accent="teal" />

          {/* vs divider */}
          <div className="flex items-center gap-2 px-1 my-1.5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">vs</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Signal B */}
          <SignalRow signal={conflict.signalB} accent="amber" />

          {/* Resolution */}
          <p className="text-[11px] text-slate-500 italic leading-relaxed mt-2 px-0.5">
            {conflict.resolution}
          </p>
        </div>
      ))}
    </div>
  );
}
