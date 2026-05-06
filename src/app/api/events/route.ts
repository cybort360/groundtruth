import { NextResponse } from "next/server";
import { getActiveEvents, getEventSignals, getUnlinkedSignalCount } from "@/lib/db";
import { seedFallbackData } from "@/lib/demo-seed";
import type { NormalizedSignal, ConflictPair } from "@/types";

function detectConflicts(signals: NormalizedSignal[]): ConflictPair[] {
  const conflicts: ConflictPair[] = [];
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const a = signals[i];
      const b = signals[j];
      if (Math.abs(a.severity - b.severity) >= 2) {
        const winner = a.credibilityScore >= b.credibilityScore ? a : b;
        conflicts.push({
          signalA: a,
          signalB: b,
          conflictType: "inconsistent_severity",
          resolution: `${winner.evidenceType === "audio" ? "Voice" : winner.evidenceType.charAt(0).toUpperCase() + winner.evidenceType.slice(1)} report (${Math.round(winner.credibilityScore * 100)}% credibility) outweighed the ${winner === a ? b.evidenceType === "audio" ? "voice" : b.evidenceType : a.evidenceType === "audio" ? "voice" : a.evidenceType} report.`,
        });
      }
    }
  }
  return conflicts;
}

export async function GET() {
  try {
    // Seed demo data on first request (handles Vercel cold starts and fresh local installs).
    seedFallbackData();
    const events = getActiveEvents();

    const enriched = events.map((event) => {
      const signals = getEventSignals(event.id);
      return {
        ...event,
        signals,
        conflicts: detectConflicts(signals),
      };
    });

    return NextResponse.json(
      {
        events: enriched,
        lastUpdated: new Date().toISOString(),
        unanalyzedCount: getUnlinkedSignalCount(),
      },
      {
        headers: {
          // Serve fresh for 10s, then serve stale while revalidating in the
          // background for up to 30s. Keeps repeated page loads instant
          // without affecting the 30s poll meaningfully.
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
