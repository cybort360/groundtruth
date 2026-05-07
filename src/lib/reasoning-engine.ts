/**
 * Reasoning Engine
 *
 * The core of GroundTruth. Takes all normalized, scored signals and produces
 * assessed events through a two-phase approach:
 *
 * Phase 1 — Pre-cluster (in code): calls geo_cluster to group signals by
 *   geographic proximity. This is done deterministically without an LLM.
 *
 * Phase 2 — Per-cluster assessment (agentic loop): for each cluster, runs a
 *   focused Gemma 4 loop. The model receives exactly the signals in that
 *   cluster, calls check_history + assess_risk for context, then MUST call
 *   update_event to persist its assessment. Each loop has a bounded scope,
 *   which dramatically improves tool-call compliance.
 */

import { agenticLoop } from "./gemma";
import { executeTool } from "./tools";
import { geoCluster } from "./tools/geo-cluster";
import { getAllSignals, getActiveEvents, getEventSignals, getEventsNear, updateEventConfidence, linkSignalToEvent, setEventAssessedBy, setEventThinkingTrace } from "./db";
import {
  CLUSTER_ASSESSMENT_SYSTEM_PROMPT,
  CLUSTER_ASSESSMENT_TOOLS,
  buildClusterPrompt,
} from "./prompts/reasoning";
import { assessClusterComplexity, routeBackendType, assessedByLabel } from "./complexity-router";
import { getBackendByType } from "./gemma-backends";
import { loadSettings } from "./gemma-backends/settings";
import type { GemmaMessage, AssessedEvent, ReasoningOutput, NormalizedSignal } from "@/types";

const CLUSTER_RADIUS_METERS = 500;
const MAX_ITERATIONS_PER_CLUSTER = 8;

/**
 * Run the full reasoning pipeline over all current signals.
 * This is the main entry point called by the /api/reasoning route.
 */
export async function runReasoning(): Promise<ReasoningOutput> {
  const signals = getAllSignals();

  if (signals.length === 0) {
    return {
      events: [],
      signalsProcessed: 0,
      conflictsDetected: 0,
    };
  }

  // ── Phase 1: Pre-cluster signals in code ──────────────────────────────────
  const clusterResult = await geoCluster({
    signal_ids: signals.map((s) => s.id),
    radius_meters: CLUSTER_RADIUS_METERS,
  });

  if (clusterResult.totalClusters === 0) {
    return {
      events: [],
      signalsProcessed: signals.length,
      conflictsDetected: 0,
    };
  }

  // ── Phase 2: One focused agentic loop per cluster ─────────────────────────
  const allThinkingTraces: string[] = [];
  const settings = loadSettings();

  for (let i = 0; i < clusterResult.clusters.length; i++) {
    const cluster = clusterResult.clusters[i];

    if (cluster.signals.length === 0) continue;

    // ── Complexity-based routing ────────────────────────────────────────────
    const complexity   = assessClusterComplexity(cluster.signals);
    const backendType  = routeBackendType(complexity, settings.backend);
    const backend      = await getBackendByType(backendType);
    const routingLabel = assessedByLabel(backendType);

    if (complexity.level === "complex") {
      console.log(
        `[routing] Cluster ${i + 1}: HIGH COMPLEXITY — escalating to ${backend.name}. ` +
        `Reasons: ${complexity.reasons.join(" | ")}`
      );
    } else {
      console.log(
        `[routing] Cluster ${i + 1}: simple cluster — using ${backend.name} (local).`
      );
    }
    // ── End routing ─────────────────────────────────────────────────────────

    const messages: GemmaMessage[] = [
      {
        role: "system",
        content: CLUSTER_ASSESSMENT_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildClusterPrompt(cluster, i, clusterResult.totalClusters),
      },
      // Pre-fill the assistant turn with Gemma 4's thinking token so the model
      // enters its chain-of-thought mode before calling any tools.
      {
        role: "assistant",
        content: "<|think|>\nLet me carefully analyze the signals in this cluster.\n",
      },
    ];

    try {
      const result = await agenticLoop(
        messages,
        CLUSTER_ASSESSMENT_TOOLS,
        executeTool,
        {
          maxIterations: MAX_ITERATIONS_PER_CLUSTER,
          thinking: true,
          backend,
        }
      );

      if (result.thinkingTrace) {
        allThinkingTraces.push(`[Cluster ${i + 1} · ${backend.name}]\n${result.thinkingTrace}`);
      }

      // Log for debugging — check whether update_event was actually called
      const persistCalls = result.toolCallHistory.filter(
        (t) => t.name === "update_event"
      );
      console.log(
        `[reasoning] Cluster ${i + 1}/${clusterResult.totalClusters}: ` +
        `${cluster.signals.length} signals, ` +
        `${result.toolCallHistory.length} tool calls, ` +
        `${persistCalls.length} update_event call(s), ` +
        `model: ${backend.name}`
      );

      // Capture the thinking trace for this cluster (concatenated across turns)
      const clusterTrace = result.thinkingTrace?.trim() ?? "";

      if (persistCalls.length === 0) {
        // Gemma failed to call update_event — fall back to a direct persist
        // using pre-computed values so the cluster isn't silently dropped.
        console.warn(`[reasoning] Cluster ${i + 1}: Gemma did not call update_event. Using fallback persister.`);
        const fallbackId = await fallbackPersist(cluster, i);
        setEventAssessedBy(fallbackId, "local-fallback");
        for (const signal of cluster.signals) {
          linkSignalToEvent(fallbackId, signal.id);
        }
      } else {
        // Link all signals in this cluster to the created event(s)
        for (const call of persistCalls) {
          const callResult = call.result as { eventId?: string } | undefined;
          if (callResult?.eventId) {
            setEventAssessedBy(callResult.eventId, routingLabel);
            if (clusterTrace) {
              setEventThinkingTrace(callResult.eventId, clusterTrace);
            }
            for (const signal of cluster.signals) {
              linkSignalToEvent(callResult.eventId!, signal.id);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[reasoning] Cluster ${i + 1} failed:`, err);
      const fallbackId = await fallbackPersist(cluster, i);
      setEventAssessedBy(fallbackId, "local-fallback");
    }
  }

  // ── Phase 3: Cross-cluster correlation ───────────────────────────────────
  // After all clusters are assessed, look for neighboring events of the same
  // type. Corroborating neighbors boost confidence; the boost is capped so a
  // single nearby event can't push an uncertain assessment to high confidence.
  const CORRELATION_RADIUS_METERS = 1000;
  const CORRELATION_CONFIDENCE_THRESHOLD = 0.55;
  const MAX_BOOST = 0.12;

  const freshEvents = getActiveEvents();
  for (const event of freshEvents) {
    const neighbors = getEventsNear(event.latitude, event.longitude, CORRELATION_RADIUS_METERS)
      .filter(
        (n) =>
          n.id !== event.id &&
          n.eventType === event.eventType &&
          n.confidence >= CORRELATION_CONFIDENCE_THRESHOLD,
      );

    if (neighbors.length === 0) continue;

    const avgNeighborConfidence =
      neighbors.reduce((sum, n) => sum + n.confidence, 0) / neighbors.length;

    // Boost scales with neighbor count (diminishing returns) and their avg confidence.
    const boost = Math.min(
      MAX_BOOST,
      neighbors.length * (avgNeighborConfidence - CORRELATION_CONFIDENCE_THRESHOLD) * 0.25,
    );

    if (boost <= 0.005) continue; // not worth updating for tiny differences

    const newConfidence = Math.min(0.97, event.confidence + boost);
    const note =
      `\n\n[Cross-cluster correlation] ${neighbors.length} nearby ${event.eventType} event(s) ` +
      `within ${CORRELATION_RADIUS_METERS}m corroborate this assessment ` +
      `(avg confidence ${Math.round(avgNeighborConfidence * 100)}%). ` +
      `Confidence adjusted from ${Math.round(event.confidence * 100)}% → ${Math.round(newConfidence * 100)}%.`;

    updateEventConfidence(event.id, newConfidence, note);
    console.log(
      `[correlation] Event "${event.title}": +${Math.round(boost * 100)}pp ` +
      `(${neighbors.length} neighbor(s), avg confidence ${Math.round(avgNeighborConfidence * 100)}%)`,
    );
  }

  // ── Fetch updated events and enrich with signals + conflicts ──────────────
  const events = getActiveEvents();

  const enrichedEvents: AssessedEvent[] = events.map((event) => {
    const eventSignals = getEventSignals(event.id);
    return {
      ...event,
      signals: eventSignals,
      conflicts: detectConflicts(eventSignals),
    };
  });

  const totalConflicts = enrichedEvents.reduce(
    (sum, e) => sum + e.conflicts.length,
    0
  );

  return {
    events: enrichedEvents,
    signalsProcessed: signals.length,
    conflictsDetected: totalConflicts,
    thinkingTrace: allThinkingTraces.join("\n\n") || undefined,
  };
}

/**
 * Fallback persister: if Gemma fails to call update_event, derive a basic
 * assessment from the cluster's signal data and persist it directly.
 * This ensures no cluster is silently dropped from the dashboard.
 */
async function fallbackPersist(
  cluster: { centroidLat: number; centroidLng: number; signals: Array<{ id: string; claim: string; evidenceType: string; credibilityScore: number; timestamp: string; locationName: string }> },
  clusterIndex: number
): Promise<string> {
  const { centroidLat, centroidLng, signals } = cluster;
  const avgCredibility = signals.reduce((s, x) => s + x.credibilityScore, 0) / signals.length;
  // Heuristic confidence: scale with signal count and avg credibility
  const confidence = Math.min(
    0.75,
    avgCredibility * (0.5 + Math.min(signals.length, 5) * 0.05)
  );
  const topSignal = [...signals].sort((a, b) => b.credibilityScore - a.credibilityScore)[0];
  const locationName = topSignal.locationName || `${centroidLat.toFixed(4)}, ${centroidLng.toFixed(4)}`;
  const title = `Unconfirmed incident — ${locationName}`;
  const reasoningChain = `${title} — ${Math.round(confidence * 100)}%\n\nEvidence for: ${signals.map((s) => `${s.evidenceType}: "${s.claim}" (credibility ${s.credibilityScore.toFixed(2)})`).join("; ")}\n\nEvidence against: none on record\n\nResolution: Automated fallback assessment. Gemma did not produce a tool-based assessment for cluster ${clusterIndex + 1}. Confidence is conservatively estimated from signal count (${signals.length}) and average credibility (${avgCredibility.toFixed(2)}).\n\nTrend: Unknown — insufficient temporal data.\n\nRecommendation: Treat this area with caution. Wait for additional signals before relying on this assessment.`;

  const result = await executeTool("update_event", {
    title,
    event_type: inferEventType(signals),
    latitude: centroidLat,
    longitude: centroidLng,
    radius_meters: 500,
    confidence,
    reasoning_chain: reasoningChain,
    status: "uncertain",
  }) as { eventId: string };
  return result.eventId;
}

/**
 * Infer a coarse event type from signal claims using keyword matching.
 * Used only by the fallback persister — Gemma selects the type for normal assessments.
 */
function inferEventType(signals: Array<{ claim: string }>): string {
  const text = signals.map((s) => s.claim.toLowerCase()).join(" ");
  if (/flood|inundat|submerge|overflow|standing water|water level/.test(text)) return "flooding";
  if (/earthquake|tremor|quake|aftershock|shaking/.test(text)) return "earthquake";
  if (/fire|wildfire|flame|smoke|burn|blaze/.test(text)) return "wildfire";
  if (/landslide|mudslide|mud flow|rockfall|slope fail/.test(text)) return "landslide";
  if (/tsunami|tidal wave|coastal inundat/.test(text)) return "tsunami";
  if (/hurricane|cyclone|typhoon|tropical storm|wind damage/.test(text)) return "tropical_storm";
  if (/avalanche|snow slide|ice slide/.test(text)) return "avalanche";
  if (/volcano|eruption|lava|ash fall|lahar/.test(text)) return "volcanic_activity";
  if (/gas leak|gas smell|pipeline|hazmat|fumes/.test(text)) return "gas_leak";
  if (/power outage|blackout|no electricity|downed line|power cut/.test(text)) return "power_outage";
  if (/road clos|road block|traffic jam|route block|impassable/.test(text)) return "road_closure";
  if (/structur|building|collapse|crack|damage|bridge fail/.test(text)) return "structural_damage";
  return "other";
}

/**
 * Detect conflicting signal pairs within an event's signals.
 * Two signals conflict if they make contradictory claims about
 * the same approximate location (severity difference ≥ 2).
 */
function detectConflicts(signals: NormalizedSignal[]) {
  const conflicts: AssessedEvent["conflicts"] = [];

  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const a = signals[i];
      const b = signals[j];
      const severityDiff = Math.abs(a.severity - b.severity);

      if (severityDiff >= 2) {
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
