import { NextResponse } from "next/server";
import { getActiveEvents, getEventSignals } from "@/lib/db";
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
          resolution: `Signal from ${winner.evidenceType} evidence (credibility: ${winner.credibilityScore.toFixed(2)}) was weighted higher.`,
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

    return NextResponse.json({
      events: enriched,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
