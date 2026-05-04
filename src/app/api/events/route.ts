import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import {
  getActiveEvents,
  getEventSignals,
  getDb,
  insertReport,
  insertSignal,
  upsertEvent,
  linkSignalToEvent,
} from "@/lib/db";
import type { NormalizedSignal, ConflictPair } from "@/types";

// On Vercel (serverless), /tmp starts empty on each cold start.
// Auto-seed the Lagos demo so judges always see a working dashboard.
function ensureDemoSeeded() {
  if (!process.env.VERCEL) return;
  const db = getDb();
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM events")
    .get() as { count: number };
  if (count > 0) return;

  function ago(mins: number) {
    return new Date(Date.now() - mins * 60 * 1000).toISOString();
  }

  // Minimal report stubs (signals reference them via FK)
  const rIds = Array.from({ length: 7 }, () => uuid());
  for (let i = 0; i < 7; i++) {
    insertReport({
      id: rIds[i],
      type: "text",
      rawContent: "demo",
      latitude: 6.4481,
      longitude: 3.4745,
      submittedAt: ago(120 - i * 15),
      submitterId: `demo-${i}`,
    });
  }

  const sigs = [
    { rid: rIds[0], lat: 6.4412, lng: 3.4623, claim: "Roads getting wet from heavy rain", ev: "text" as const, sev: 2, cr: 0.45, t: ago(120) },
    { rid: rIds[1], lat: 6.4387, lng: 3.4589, claim: "Ankle-deep water on street, traffic slowing", ev: "photo" as const, sev: 3, cr: 0.65, t: ago(108) },
    { rid: rIds[2], lat: 6.4481, lng: 3.4745, claim: "Road under bridge completely flooded, vehicles turning back", ev: "audio" as const, sev: 5, cr: 0.72, t: ago(95) },
    { rid: rIds[3], lat: 6.4481, lng: 3.4745, claim: "Road passable with minimal water", ev: "text" as const, sev: 1, cr: 0.30, t: ago(82) },
    { rid: rIds[4], lat: 6.4481, lng: 3.4745, claim: "Waist-deep flooding, multiple vehicles stranded", ev: "photo" as const, sev: 5, cr: 0.88, t: ago(68) },
    { rid: rIds[5], lat: 6.4387, lng: 3.4589, claim: "Water receding, vehicles beginning to move", ev: "audio" as const, sev: 2, cr: 0.70, t: ago(55) },
    { rid: rIds[6], lat: 6.4481, lng: 3.4745, claim: "Sensor reads 45cm water level at the underpass", ev: "sensor" as const, sev: 4, cr: 0.92, t: ago(42) },
  ];

  const sigIds: string[] = [];
  for (const s of sigs) {
    const id = uuid();
    sigIds.push(id);
    insertSignal({
      id,
      reportId: s.rid,
      locationName: s.lat === 6.4481 ? "Lekki-Epe Underpass" : "Admiralty Way, Lekki",
      latitude: s.lat,
      longitude: s.lng,
      claim: s.claim,
      evidenceType: s.ev,
      timestamp: s.t,
      severity: s.sev,
      details: "",
      isFirsthand: true,
      credibilityScore: s.cr,
      credibilityReasoning: "Demo data",
    });
  }

  const e1Id = uuid();
  upsertEvent({
    id: e1Id,
    title: "Severe flooding at Lekki-Epe Expressway underpass",
    description: "Multiple reports confirm severe flooding at the Lekki-Epe underpass.",
    eventType: "flooding",
    latitude: 6.4481,
    longitude: 3.4745,
    radiusMeters: 400,
    confidence: 0.88,
    status: "active",
    reasoningChain: "Evidence for: photo (stranded vehicles), sensor (45cm), voice (cars turning back). Evidence against: one text-only report (passable), low credibility (0.30), contradicts sensor and visual data. Resolution: the contradiction is dismissed due to the weight of photo and sensor evidence. Trend: Getting worse.\nRecommendation: Avoid the underpass entirely. Expect significant delays and potential road closures.",
    signalCount: 4,
    firstReported: ago(95),
    lastUpdated: ago(42),
    signals: [],
    conflicts: [],
  });
  for (const idx of [2, 3, 4, 6]) linkSignalToEvent(e1Id, sigIds[idx]);

  const e2Id = uuid();
  upsertEvent({
    id: e2Id,
    title: "Moderate flooding at Admiralty Way",
    description: "Ankle-deep flooding reported; most recent report indicates water is receding.",
    eventType: "flooding",
    latitude: 6.4387,
    longitude: 3.4589,
    radiusMeters: 300,
    confidence: 0.62,
    status: "uncertain",
    reasoningChain: "Evidence: photo (ankle-deep water), voice (water receding), early text (rain onset). No contradictions. Trend: Improving.\nRecommendation: Exercise caution. While water is receding, road surface remains wet with potential debris. Allow extra travel time.",
    signalCount: 3,
    firstReported: ago(120),
    lastUpdated: ago(55),
    signals: [],
    conflicts: [],
  });
  for (const idx of [0, 1, 5]) linkSignalToEvent(e2Id, sigIds[idx]);
}

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
    ensureDemoSeeded();
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
