import type { ConflictPair, NormalizedSignal } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 0) return "just now";
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function evidenceIcon(evidenceType: NormalizedSignal["evidenceType"]): string {
  switch (evidenceType) {
    case "photo":
      return "📷";
    case "audio":
      return "🎤";
    case "text":
      return "📝";
    case "sensor":
      return "📡";
    default:
      return "📌";
  }
}

function credibilityColor(score: number): string {
  if (score >= 0.6) return "text-green-600";
  if (score >= 0.4) return "text-amber-600";
  return "text-red-600";
}

function conflictTypeLabel(conflictType: ConflictPair["conflictType"]): string {
  switch (conflictType) {
    case "contradictory_claims":
      return "Contradictory claims";
    case "inconsistent_severity":
      return "Inconsistent severity";
    case "temporal_disagreement":
      return "Temporal disagreement";
    default:
      return "Conflict";
  }
}

// ---------------------------------------------------------------------------
// Signal card (left / right)
// ---------------------------------------------------------------------------

interface SignalCardProps {
  signal: NormalizedSignal;
  accentClass: string;
}

function SignalCard({ signal, accentClass }: SignalCardProps) {
  const pct = Math.round(signal.credibilityScore * 100);

  return (
    <div
      className={`flex-1 bg-white border border-gray-200 rounded-xl p-4 ${accentClass}`}
    >
      {/* Evidence icon */}
      <div className="text-center text-3xl mb-3" aria-label={`Evidence: ${signal.evidenceType}`}>
        {evidenceIcon(signal.evidenceType)}
      </div>

      {/* Claim */}
      <p className="italic text-sm text-gray-800 line-clamp-4 mb-3">
        {signal.claim}
      </p>

      {/* Credibility score */}
      <p className={`text-2xl font-bold mb-1 ${credibilityColor(signal.credibilityScore)}`}>
        {pct}%
      </p>
      <p className="text-xs text-gray-500 mb-2">credibility</p>

      {/* Timestamp */}
      <p className="text-xs text-gray-500 mb-2">
        {getRelativeTime(signal.timestamp)}
      </p>

      {/* Firsthand / Secondhand badge */}
      {signal.isFirsthand ? (
        <span className="inline-block bg-green-100 text-green-700 text-xs font-medium rounded-full px-2 py-0.5">
          Firsthand
        </span>
      ) : (
        <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium rounded-full px-2 py-0.5">
          Secondhand
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Center column
// ---------------------------------------------------------------------------

interface CenterColumnProps {
  conflict: ConflictPair;
}

function CenterColumn({ conflict }: CenterColumnProps) {
  const credA = conflict.signalA.credibilityScore;
  const credB = conflict.signalB.credibilityScore;
  const total = credA + credB;
  const weightA = total === 0 ? 0.5 : credA / total;
  const weightB = 1 - weightA;

  const weightAPct = Math.round(weightA * 100);
  const weightBPct = 100 - weightAPct;

  // Determine winner
  const diff = Math.abs(weightAPct - weightBPct);
  const isEqual = diff <= 5;
  const aWins = !isEqual && weightAPct > weightBPct;

  return (
    <div className="flex flex-col items-center justify-center gap-3 min-w-[140px] px-2">
      {/* Conflict type label */}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-center">
        {conflictTypeLabel(conflict.conflictType)}
      </p>

      {/* Weight bar */}
      <div className="w-full">
        <div className="flex w-full h-4 rounded-full overflow-hidden">
          <div
            className="bg-blue-500 flex items-center justify-center"
            style={{ width: `${weightAPct}%` }}
            title={`Signal A: ${weightAPct}%`}
          >
            {weightAPct >= 20 && (
              <span className="text-white text-xs font-bold leading-none">A</span>
            )}
          </div>
          <div
            className="bg-amber-500 flex items-center justify-center"
            style={{ width: `${weightBPct}%` }}
            title={`Signal B: ${weightBPct}%`}
          >
            {weightBPct >= 20 && (
              <span className="text-white text-xs font-bold leading-none">B</span>
            )}
          </div>
        </div>

        {/* Winner label */}
        <p
          className={`text-xs font-bold text-center mt-1 ${
            isEqual
              ? "text-gray-500"
              : aWins
              ? "text-blue-600"
              : "text-amber-600"
          }`}
        >
          {isEqual
            ? "Equally weighted"
            : aWins
            ? "Signal A favored"
            : "Signal B favored"}
        </p>
      </div>

      {/* Resolution text */}
      <p className="text-xs text-gray-600 italic leading-relaxed text-center">
        {conflict.resolution}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConflictViewProps {
  conflicts: ConflictPair[];
  eventTitle?: string;
}

// ---------------------------------------------------------------------------
// Main component (server-renderable — no "use client", no hooks)
// ---------------------------------------------------------------------------

export default function ConflictView({ conflicts, eventTitle }: ConflictViewProps) {
  if (conflicts.length === 0) return null;

  const showCounter = conflicts.length > 1;

  return (
    <div>
      {eventTitle && (
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {eventTitle} — conflicts
        </p>
      )}

      {conflicts.map((conflict, index) => (
        <div
          key={`${conflict.signalA.id}-${conflict.signalB.id}`}
          className={index > 0 ? "border-t border-gray-100 pt-4 mt-4" : undefined}
        >
          {showCounter && (
            <p className="text-xs text-gray-400 mb-2">
              Conflict {index + 1} of {conflicts.length}
            </p>
          )}

          {/* Three-column layout */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <SignalCard
              signal={conflict.signalA}
              accentClass="border-l-4 border-l-blue-400"
            />
            <CenterColumn conflict={conflict} />
            <SignalCard
              signal={conflict.signalB}
              accentClass="border-l-4 border-l-amber-400"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
