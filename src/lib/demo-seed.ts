/**
 * Demo seed — pre-cooked Lagos flooding scenario data.
 *
 * Inserts signals and events directly without any AI calls.
 * Safe to call from API routes on cold-start (e.g. Vercel /tmp DB).
 *
 * Extracted from seed-demo.ts so it can be imported without a process.exit().
 */

import { v4 as uuid } from "uuid";
import { getDb, insertReport, insertSignal, upsertEvent, linkSignalToEvent, setEventThinkingTrace } from "./db";
import type { Report, NormalizedSignal } from "@/types";

/** Returns true if the DB already contains Lagos-area demo signals. */
export function isAlreadySeeded(): boolean {
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

/** Inserts the full Lagos flooding demo scenario. No AI calls required. */
export function seedFallbackData(): void {
  if (isAlreadySeeded()) return;

  function ago(minutes: number) {
    return new Date(Date.now() - minutes * 60 * 1000).toISOString();
  }
  const BASE = 120;

  // ── Reports ────────────────────────────────────────────────────────────────

  const reports: Report[] = [
    { id: uuid(), type: "text",   rawContent: "Heavy rain started, roads getting wet",                                                              latitude: 6.4412, longitude: 3.4623, submittedAt: ago(BASE),      submitterId: "user-a" },
    { id: uuid(), type: "photo",  rawContent: "Photo description: ankle-deep water visible on street surface, vehicles moving slowly",              latitude: 6.4387, longitude: 3.4589, submittedAt: ago(BASE - 12), submitterId: "user-b" },
    { id: uuid(), type: "voice",  rawContent: "The road under the bridge is completely flooded, cars are turning back",                             latitude: 6.4481, longitude: 3.4745, submittedAt: ago(BASE - 25), submitterId: "user-c" },
    { id: uuid(), type: "text",   rawContent: "I just drove through, it's fine, barely any water",                                                  latitude: 6.4481, longitude: 3.4745, submittedAt: ago(BASE - 38), submitterId: "user-d" },
    { id: uuid(), type: "photo",  rawContent: "Photo description: waist-deep flooding with multiple vehicles stranded, people wading through water", latitude: 6.4481, longitude: 3.4745, submittedAt: ago(BASE - 52), submitterId: "user-e" },
    { id: uuid(), type: "voice",  rawContent: "Water is going down slowly, some cars starting to move again",                                       latitude: 6.4387, longitude: 3.4589, submittedAt: ago(BASE - 65), submitterId: "user-f" },
    { id: uuid(), type: "sensor", rawContent: "Water level sensor reading: 45cm at the underpass",                                                  latitude: 6.4481, longitude: 3.4745, submittedAt: ago(BASE - 78), submitterId: "user-g" },
  ];

  for (const r of reports) insertReport(r);

  // ── Signals ────────────────────────────────────────────────────────────────

  const signals: NormalizedSignal[] = [
    { id: uuid(), reportId: reports[0].id, locationName: "Lekki Phase 1",           latitude: 6.4412, longitude: 3.4623, claim: "Roads getting wet from heavy rain",                       evidenceType: "text",   timestamp: reports[0].submittedAt, severity: 2, details: "Early-stage rainfall report; no depth measurements.",                                      isFirsthand: true, credibilityScore: 0.45, credibilityReasoning: "Firsthand text report, early-stage, low specificity, no measurement" },
    { id: uuid(), reportId: reports[1].id, locationName: "Admiralty Way, Lekki",    latitude: 6.4387, longitude: 3.4589, claim: "Ankle-deep water on street, traffic slowing",            evidenceType: "photo",  timestamp: reports[1].submittedAt, severity: 3, details: "Photo shows standing water on road surface with slow traffic.",                           isFirsthand: true, credibilityScore: 0.65, credibilityReasoning: "Photo evidence submitted, moderate water depth reported, firsthand" },
    { id: uuid(), reportId: reports[2].id, locationName: "Lekki-Epe Expressway",    latitude: 6.4481, longitude: 3.4745, claim: "Road under bridge completely flooded, vehicles turning back", evidenceType: "audio", timestamp: reports[2].submittedAt, severity: 5, details: "Voice report of complete road closure at underpass.",                                   isFirsthand: true, credibilityScore: 0.72, credibilityReasoning: "Firsthand voice report, high severity, specific location, corroborated by later reports" },
    { id: uuid(), reportId: reports[3].id, locationName: "Lekki-Epe Expressway",    latitude: 6.4481, longitude: 3.4745, claim: "Road passable with minimal water",                       evidenceType: "text",   timestamp: reports[3].submittedAt, severity: 1, details: "Driver reports road passable; contradicts other evidence.",                              isFirsthand: true, credibilityScore: 0.30, credibilityReasoning: "Contradicts photo and voice evidence; text-only, low specificity, likely refers to different section" },
    { id: uuid(), reportId: reports[4].id, locationName: "Lekki-Epe Expressway",    latitude: 6.4481, longitude: 3.4745, claim: "Waist-deep flooding, multiple vehicles stranded",        evidenceType: "photo",  timestamp: reports[4].submittedAt, severity: 5, details: "Photo shows severe flooding with stranded vehicles and wading pedestrians.",              isFirsthand: true, credibilityScore: 0.88, credibilityReasoning: "Strong photo evidence, high severity, corroborated by sensor and voice reports" },
    { id: uuid(), reportId: reports[5].id, locationName: "Admiralty Way, Lekki",    latitude: 6.4387, longitude: 3.4589, claim: "Water receding, vehicles beginning to move",             evidenceType: "audio",  timestamp: reports[5].submittedAt, severity: 2, details: "Voice report indicates improving conditions on Admiralty Way.",                           isFirsthand: true, credibilityScore: 0.70, credibilityReasoning: "Firsthand voice, most recent report for this location, consistent with improving conditions" },
    { id: uuid(), reportId: reports[6].id, locationName: "Lekki-Epe Underpass",     latitude: 6.4481, longitude: 3.4745, claim: "Sensor reads 45cm water level",                         evidenceType: "sensor", timestamp: reports[6].submittedAt, severity: 4, details: "Automated water level sensor at underpass. 45cm depth recorded.",                        isFirsthand: true, credibilityScore: 0.92, credibilityReasoning: "Objective sensor measurement, highest credibility evidence type, corroborates visual reports" },
  ];

  for (const s of signals) insertSignal(s);

  // ── Event 1: Lekki-Epe underpass — severe ─────────────────────────────────

  const event1Id = uuid();
  upsertEvent({
    id: event1Id,
    title: "Severe flooding — Lekki-Epe Expressway underpass",
    description: "Multiple reports confirm severe flooding at the Lekki-Epe underpass. Sensor data validates visual evidence.",
    eventType: "flooding",
    latitude: 6.4481,
    longitude: 3.4745,
    radiusMeters: 400,
    confidence: 0.88,
    status: "active",
    reasoningChain:
      "Evidence for: Signal E (photo: waist-deep water, stranded vehicles, credibility 88%). Signal G (sensor: 45 cm depth, credibility 92%). Signal C (voice: vehicles turning back, credibility 72%). Evidence against: Signal D ('barely any water', text-only, credibility 30%) — contradicts photo and sensor data; likely refers to a different road section or predates the peak. Resolution: Signal D is downweighted; three independent sources with visual and sensor evidence confirm severe flooding. Trend: Worsening over the observation window. Recommendation: Avoid the underpass entirely. Use alternative routes.",
    signalCount: 4,
    firstReported: reports[2].submittedAt,
    lastUpdated: reports[6].submittedAt,
    signals: [],
    conflicts: [],
  });
  for (const sig of [signals[2], signals[3], signals[4], signals[6]]) {
    linkSignalToEvent(event1Id, sig.id);
  }

  setEventThinkingTrace(event1Id, `Signal inventory: I have four signals for this cluster at the Lekki-Epe underpass area.

Signal C (audio, credibility 0.72): "Road under bridge completely flooded, vehicles turning back." This is a firsthand voice report. The observer was present and describes a complete blockage — that's meaningful. Credibility is solid but audio lacks visual confirmation.

Signal D (text, credibility 0.30): "I just drove through, it's fine, barely any water." This directly contradicts Signal C and the other evidence. Credibility is very low. Possible explanations: (1) this person drove through a different section of road, (2) timing — this report is older than Signal C, meaning conditions worsened after they passed, (3) the observer is minimising. I'm leaning toward explanation (2) since the timestamp predates the peak flood reports. I'll downweight this heavily.

Signal E (photo, credibility 0.88): Waist-deep flooding with stranded vehicles. This is strong visual evidence. Photos are harder to fabricate than text. The description of multiple stranded vehicles is specific and alarming. High weight.

Signal G (sensor, credibility 0.92): Water level sensor reads 45 cm at the underpass. This is objective measurement. 45 cm is waist-depth on a small adult — consistent with Signal E. Sensors don't lie unless they're faulty, and there's no indication of malfunction. This is my anchor signal.

Contradiction analysis: Signal D vs Signals C, E, G. The weight of evidence is 3:1 against Signal D, and the supporting signals are higher-credibility types (sensor, photo, audio vs text). The temporal ordering also favours dismissing D. Resolution is clear.

Confidence calibration: Three independent sources — voice, photo, sensor — all confirm severe flooding. The sensor removes subjective interpretation. The only dissenter is a low-credibility text report with a plausible alternative explanation. I'm comfortable at 88% confidence. I won't go higher because I don't have corroborating sensor data from a second location.

Historical plausibility: The Lekki-Epe underpass is a known flood-prone location. This is consistent with the risk profile.

Decision: active, severe flooding, confidence 0.88. Call update_event.`);

  // ── Event 2: Admiralty Way — moderate / improving ─────────────────────────

  const event2Id = uuid();
  upsertEvent({
    id: event2Id,
    title: "Moderate flooding — Admiralty Way",
    description: "Ankle-deep flooding reported on Admiralty Way; most recent voice report indicates water is receding.",
    eventType: "flooding",
    latitude: 6.4387,
    longitude: 3.4589,
    radiusMeters: 300,
    confidence: 0.62,
    status: "uncertain",
    reasoningChain:
      "Evidence for: Signal B (photo: ankle-deep water, credibility 65%). Signal A (text: heavy rain onset, credibility 45%). Evidence against: Signal F (voice: water receding, vehicles moving, credibility 70%) — conditions appear to be improving. Resolution: Flooding occurred and is partially subsiding. Moderate confidence given the improving trend and single photo data point. Trend: Improving — water level declining but flooding ongoing. Recommendation: Proceed with caution, monitor conditions.",
    signalCount: 3,
    firstReported: reports[0].submittedAt,
    lastUpdated: reports[5].submittedAt,
    signals: [],
    conflicts: [],
  });
  for (const sig of [signals[0], signals[1], signals[5]]) {
    linkSignalToEvent(event2Id, sig.id);
  }

  setEventThinkingTrace(event2Id, `Signal inventory: Three signals for Admiralty Way cluster.

Signal A (text, credibility 0.45): "Heavy rain started, roads getting wet." This is the earliest report — it describes onset conditions, not active flooding. Low specificity, no depth measurement. Useful for establishing a timeline but not much else.

Signal B (photo, credibility 0.65): Ankle-deep water, traffic slowing. Photo evidence is good. Ankle-deep (roughly 15–25 cm) is serious but not catastrophic. Traffic is slowing, not stopped — that's a key distinction from the underpass cluster.

Signal F (audio, credibility 0.70): "Water is going down slowly, some cars starting to move again." This is the most recent report and it describes improving conditions. Credibility is higher than Signal B. The fact that cars are moving again suggests the peak has passed.

Temporal reasoning: Signal A is oldest → Signal B is middle → Signal F is most recent. The trend is: rain starts → ankle-deep flooding → water receding. This is a classic flash-flood profile. The system is recovering.

Contradiction analysis: Signal B (flooding) vs Signal F (improving). These aren't actually contradictory — they describe different moments in the same event's lifecycle. Signal F is simply more current.

Confidence calibration: I'm uncertain here. The flooding clearly happened (Signal B is photo evidence). But Signal F suggests it's resolving. I don't have sensor data for this location. If I say "active" I might be wrong by the time someone acts on it. If I say "resolved" I might be wrong too — the water could return.

I'll set status to "uncertain" at 0.62 confidence. The flooding is real but the current state is unclear. Someone approaching Admiralty Way should proceed with caution and be ready to turn around.`);
}
