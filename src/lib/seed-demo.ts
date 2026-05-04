/**
 * Demo Seed Script - Lagos Flooding Scenario
 *
 * Populates the SQLite database with a realistic flooding demo so judges
 * see a working dashboard on arrival.
 *
 * Two modes:
 *   Live path   - Ollama reachable → full AI pipeline (normalize → score → reason)
 *   Fallback path - Ollama unreachable → insert pre-cooked signals + events directly
 *
 * Usage:  npx tsx src/lib/seed-demo.ts
 */

import { v4 as uuid } from "uuid";
import {
  getDb,
  insertReport,
  insertSignal,
  upsertEvent,
  linkSignalToEvent,
} from "./db";
import { normalizeReport } from "./signal-normalizer";
import { scoreCredibility } from "./credibility-scorer";
import { runReasoning } from "./reasoning-engine";
import type { Report, NormalizedSignal } from "../types/index";

// ---------------------------------------------------------------------------
// Ollama availability check
// ---------------------------------------------------------------------------

async function checkOllama(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return an ISO string for `minutesAgo` minutes before now. */
function ago(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

// Base time: 120 minutes ago. Each report is spaced 10–15 min forward.
const BASE_MINUTES = 120;

/** Raw report definitions (order matches the table in the brief). */
function buildReports(): Report[] {
  return [
    {
      id: uuid(),
      type: "text",
      rawContent: "Heavy rain started, roads getting wet",
      latitude: 6.4412,
      longitude: 3.4623,
      submittedAt: ago(BASE_MINUTES), // t-120 min
      submitterId: "user-a",
    },
    {
      id: uuid(),
      type: "photo",
      rawContent:
        "Photo description: ankle-deep water visible on street surface, vehicles moving slowly",
      latitude: 6.4387,
      longitude: 3.4589,
      submittedAt: ago(BASE_MINUTES - 12), // t-108 min
      submitterId: "user-b",
    },
    {
      id: uuid(),
      type: "voice",
      rawContent:
        "The road under the bridge is completely flooded, cars are turning back",
      latitude: 6.4481,
      longitude: 3.4745,
      submittedAt: ago(BASE_MINUTES - 25), // t-95 min
      submitterId: "user-c",
    },
    {
      id: uuid(),
      type: "text",
      rawContent: "I just drove through, it's fine, barely any water",
      latitude: 6.4481,
      longitude: 3.4745,
      submittedAt: ago(BASE_MINUTES - 38), // t-82 min
      submitterId: "user-d",
    },
    {
      id: uuid(),
      type: "photo",
      rawContent:
        "Photo description: waist-deep flooding with multiple vehicles stranded, people wading through water",
      latitude: 6.4481,
      longitude: 3.4745,
      submittedAt: ago(BASE_MINUTES - 52), // t-68 min
      submitterId: "user-e",
    },
    {
      id: uuid(),
      type: "voice",
      rawContent: "Water is going down slowly, some cars starting to move again",
      latitude: 6.4387,
      longitude: 3.4589,
      submittedAt: ago(BASE_MINUTES - 65), // t-55 min
      submitterId: "user-f",
    },
    {
      id: uuid(),
      type: "sensor",
      rawContent: "Water level sensor reading: 45cm at the underpass",
      latitude: 6.4481,
      longitude: 3.4745,
      submittedAt: ago(BASE_MINUTES - 78), // t-42 min
      submitterId: "user-g",
    },
  ];
}

// ---------------------------------------------------------------------------
// Live path - full AI pipeline
// ---------------------------------------------------------------------------

async function seedWithOllama(reports: Report[]): Promise<void> {
  console.log("[seed] Ollama reachable - running full AI pipeline");

  for (const report of reports) {
    console.log(
      `[seed]   Inserting report ${report.submitterId} (${report.type})`
    );
    insertReport(report);

    let signal: NormalizedSignal;
    try {
      console.log(`[seed]   Normalizing report ${report.submitterId}...`);
      signal = await normalizeReport(report);
    } catch (err) {
      console.log(
        `[seed]   normalizeReport failed for ${report.submitterId}: ${(err as Error).message}. Skipping signal.`
      );
      continue;
    }

    try {
      console.log(`[seed]   Scoring credibility for ${report.submitterId}...`);
      const cred = await scoreCredibility(signal);
      signal.credibilityScore = cred.overallScore;
      signal.credibilityReasoning = cred.reasoning;
    } catch (err) {
      console.log(
        `[seed]   scoreCredibility failed for ${report.submitterId}: ${(err as Error).message}. Using default score.`
      );
      signal.credibilityScore = 0.5;
      signal.credibilityReasoning =
        "Credibility scoring unavailable - default score assigned.";
    }

    console.log(
      `[seed]   Saving signal for ${report.submitterId} (score: ${signal.credibilityScore.toFixed(2)})`
    );
    insertSignal(signal);
  }

  console.log("[seed] Running reasoning engine...");
  try {
    const result = await runReasoning();
    console.log(
      `[seed] Reasoning complete - ${result.events.length} event(s), ${result.conflictsDetected} conflict(s)`
    );
  } catch (err) {
    console.log(
      `[seed] runReasoning failed: ${(err as Error).message}. Events may be empty.`
    );
  }
}

// ---------------------------------------------------------------------------
// Fallback path - pre-cooked data, no AI calls
// ---------------------------------------------------------------------------

function seedFallback(): void {
  console.log("[seed] Ollama unreachable - inserting pre-cooked fallback data");

  const reports = buildReports();

  // Insert reports first (signals FK-reference them)
  for (const report of reports) {
    insertReport(report);
  }

  // Pre-cooked signals in the same order as reports (A–G)
  const fallbackSignals: NormalizedSignal[] = [
    {
      id: uuid(),
      reportId: reports[0].id, // User A
      locationName: "Lekki Phase 1",
      latitude: 6.4412,
      longitude: 3.4623,
      claim: "Roads getting wet from heavy rain",
      evidenceType: "text",
      timestamp: reports[0].submittedAt,
      severity: 2,
      details: "Early-stage rainfall report; no depth measurements.",
      isFirsthand: true,
      credibilityScore: 0.45,
      credibilityReasoning:
        "Firsthand text report, early-stage, low specificity, no measurement",
    },
    {
      id: uuid(),
      reportId: reports[1].id, // User B
      locationName: "Admiralty Way, Lekki",
      latitude: 6.4387,
      longitude: 3.4589,
      claim: "Ankle-deep water on street, traffic slowing",
      evidenceType: "photo",
      timestamp: reports[1].submittedAt,
      severity: 3,
      details: "Photo shows standing water on road surface with slow traffic.",
      isFirsthand: true,
      credibilityScore: 0.65,
      credibilityReasoning:
        "Photo evidence submitted, moderate water depth reported, firsthand",
    },
    {
      id: uuid(),
      reportId: reports[2].id, // User C
      locationName: "Lekki-Epe Expressway",
      latitude: 6.4481,
      longitude: 3.4745,
      claim: "Road under bridge completely flooded, vehicles turning back",
      evidenceType: "audio",
      timestamp: reports[2].submittedAt,
      severity: 5,
      details: "Voice report of complete road closure at underpass.",
      isFirsthand: true,
      credibilityScore: 0.72,
      credibilityReasoning:
        "Firsthand voice report, high severity, specific location, corroborated by later reports",
    },
    {
      id: uuid(),
      reportId: reports[3].id, // User D
      locationName: "Lekki-Epe Expressway",
      latitude: 6.4481,
      longitude: 3.4745,
      claim: "Road passable with minimal water",
      evidenceType: "text",
      timestamp: reports[3].submittedAt,
      severity: 1,
      details: "Driver reports road passable; contradicts other evidence.",
      isFirsthand: true,
      credibilityScore: 0.3,
      credibilityReasoning:
        "Contradicts photo and voice evidence; text-only, low specificity, likely refers to different section",
    },
    {
      id: uuid(),
      reportId: reports[4].id, // User E
      locationName: "Lekki-Epe Expressway",
      latitude: 6.4481,
      longitude: 3.4745,
      claim: "Waist-deep flooding, multiple vehicles stranded",
      evidenceType: "photo",
      timestamp: reports[4].submittedAt,
      severity: 5,
      details: "Photo shows severe flooding with stranded vehicles and wading pedestrians.",
      isFirsthand: true,
      credibilityScore: 0.88,
      credibilityReasoning:
        "Strong photo evidence, high severity, corroborated by sensor and voice reports",
    },
    {
      id: uuid(),
      reportId: reports[5].id, // User F
      locationName: "Admiralty Way, Lekki",
      latitude: 6.4387,
      longitude: 3.4589,
      claim: "Water receding, vehicles beginning to move",
      evidenceType: "audio",
      timestamp: reports[5].submittedAt,
      severity: 2,
      details: "Voice report indicates improving conditions on Admiralty Way.",
      isFirsthand: true,
      credibilityScore: 0.7,
      credibilityReasoning:
        "Firsthand voice, most recent report for this location, consistent with improving conditions",
    },
    {
      id: uuid(),
      reportId: reports[6].id, // User G
      locationName: "Lekki-Epe Underpass",
      latitude: 6.4481,
      longitude: 3.4745,
      claim: "Sensor reads 45cm water level",
      evidenceType: "sensor",
      timestamp: reports[6].submittedAt,
      severity: 4,
      details: "Automated water level sensor at underpass. 45cm depth recorded.",
      isFirsthand: true,
      credibilityScore: 0.92,
      credibilityReasoning:
        "Objective sensor measurement, highest credibility evidence type, corroborates visual reports",
    },
  ];

  for (const signal of fallbackSignals) {
    console.log(`[seed]   Inserting signal: ${signal.claim.slice(0, 50)}...`);
    insertSignal(signal);
  }

  // --- Event 1: Lekki-Epe Expressway severe flooding ---
  const event1Id = uuid();
  const event1Signals = [
    fallbackSignals[2], // C
    fallbackSignals[3], // D
    fallbackSignals[4], // E
    fallbackSignals[6], // G
  ];

  console.log("[seed]   Inserting event: Severe flooding - Lekki-Epe Expressway underpass");
  upsertEvent({
    id: event1Id,
    title: "Severe flooding - Lekki-Epe Expressway underpass",
    description:
      "Multiple reports confirm severe flooding at the Lekki-Epe underpass. Sensor data validates visual evidence.",
    eventType: "flooding",
    latitude: 6.4481,
    longitude: 3.4745,
    radiusMeters: 400,
    confidence: 0.88,
    status: "active",
    reasoningChain:
      "3 of 4 reports indicate significant flooding at the Lekki-Epe underpass. Signal D ('barely any water', text-only) contradicts photo and sensor evidence and is likely referring to a different section. Signal E (photo: waist-deep water with stranded vehicles) is the strongest visual evidence. Sensor data (Signal G) independently confirms 45cm water depth. Signal C (voice: vehicles turning back) corroborates. Signal D is downweighted due to low credibility score (0.30) and lack of photo evidence. Assessment: underpass is impassable. Confidence: 88%.",
    signalCount: event1Signals.length,
    firstReported: reports[2].submittedAt,
    lastUpdated: reports[6].submittedAt,
    signals: [],
    conflicts: [],
  });

  for (const sig of event1Signals) {
    linkSignalToEvent(event1Id, sig.id);
  }

  // --- Event 2: Admiralty Way moderate flooding ---
  const event2Id = uuid();
  const event2Signals = [
    fallbackSignals[0], // A
    fallbackSignals[1], // B
    fallbackSignals[5], // F
  ];

  console.log("[seed]   Inserting event: Moderate flooding - Admiralty Way");
  upsertEvent({
    id: event2Id,
    title: "Moderate flooding - Admiralty Way",
    description:
      "Ankle-deep flooding reported on Admiralty Way; most recent voice report indicates water is receding.",
    eventType: "flooding",
    latitude: 6.4387,
    longitude: 3.4589,
    radiusMeters: 300,
    confidence: 0.62,
    status: "uncertain",
    reasoningChain:
      "Initial photo (Signal B) showed ankle-deep water on Admiralty Way. Most recent voice report (Signal F) indicates water is receding and vehicles are moving. Early text report (Signal A) confirms heavy rain onset. Conditions appear to be improving but flooding is ongoing. Moderate confidence due to improving trend and single photo data point. Assessment: proceed with caution, conditions improving. Confidence: 62%.",
    signalCount: event2Signals.length,
    firstReported: reports[0].submittedAt,
    lastUpdated: reports[5].submittedAt,
    signals: [],
    conflicts: [],
  });

  for (const sig of event2Signals) {
    linkSignalToEvent(event2Id, sig.id);
  }
}

// ---------------------------------------------------------------------------
// Already-seeded check
// ---------------------------------------------------------------------------

function isAlreadySeeded(): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM signals
       WHERE latitude BETWEEN 6.43 AND 6.46
         AND longitude BETWEEN 3.44 AND 3.49`
    )
    .get() as { count: number };
  return row.count > 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[seed] GroundTruth - Lagos flood scenario seed script");

  // 1. Already seeded?
  if (isAlreadySeeded()) {
    console.log("[seed] Already seeded - database contains Lagos-area signals. Exiting.");
    process.exit(0);
  }

  // 2. Check Ollama
  console.log("[seed] Checking Ollama availability...");
  const ollamaUp = await checkOllama();
  console.log(`[seed] Ollama: ${ollamaUp ? "reachable" : "unreachable"}`);

  // 3. Build report objects (timestamps based on current run time)
  const reports = buildReports();

  // 4. Seed via live path or fallback
  if (ollamaUp) {
    await seedWithOllama(reports);
  } else {
    seedFallback();
  }

  // 5. Summary
  const db = getDb();
  const sigCount = (
    db.prepare("SELECT COUNT(*) as c FROM signals").get() as { c: number }
  ).c;
  const evtCount = (
    db.prepare("SELECT COUNT(*) as c FROM events").get() as { c: number }
  ).c;

  console.log(
    `[seed] Done - ${sigCount} signal(s), ${evtCount} event(s) in database.`
  );
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
