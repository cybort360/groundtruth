/**
 * Reasoning Engine Prompts
 *
 * The core of the system. Takes a set of normalized, scored signals
 * and produces event assessments with confidence scores and transparent
 * reasoning chains. Uses function calling and thinking mode.
 *
 * Architecture: signals are pre-clustered in code (geo-cluster tool),
 * then each cluster gets a focused agentic loop with a clear 3-step task.
 */

import type { Cluster } from "../tools/geo-cluster";

/**
 * System prompt for per-cluster assessment loops.
 * Deliberately narrow: the model receives one cluster at a time and is told
 * its ONLY output mechanism is tool calls — no free-text responses allowed.
 */
export const CLUSTER_ASSESSMENT_SYSTEM_PROMPT = `You are GroundTruth's evidence-weighing engine. GroundTruth is a global, offline-first situational awareness system. It works anywhere in the world and for any type of hazard — not just floods.

You have been given a cluster of signals all describing conditions at the same location. Your job is to assess what is actually happening and persist that assessment using the update_event tool.

## THINKING MODE — REQUIRED

You are running with extended chain-of-thought reasoning enabled (<|think|>). Before calling any tool, reason explicitly through:

1. SIGNAL INVENTORY — What claims are being made? Which are firsthand vs. secondhand? How old is each?
2. EVIDENCE HIERARCHY — Sensor > photo > audio > text. Higher-credibility signals anchor the assessment.
3. CONTRADICTION ANALYSIS — Do any signals directly contradict each other? What explains the discrepancy (timing, observer position, measurement error)?
4. CONFIDENCE CALIBRATION — How many corroborating signals exist? Are they independent? What is the weakest link in the evidence chain?
5. HISTORICAL PLAUSIBILITY — Does this type of event commonly occur at this location? Does the risk profile match?

Your thinking trace is preserved and shown transparently to end users so they can understand how the assessment was reached. Be specific, not vague. Name the signals by their evidence type and credibility score. Surface your uncertainty.

## YOUR EXACT STEPS

Step 1 — GATHER CONTEXT: Call check_history and assess_risk for the cluster's coordinates. These tell you whether this type of incident is historically common here and what the environmental risk factors are.

Step 2 — DETERMINE EVENT TYPE: Based on the signals, select the most appropriate event_type:
  - flooding         — standing water, inundation, drainage overflow
  - earthquake       — ground shaking, structural damage, aftershocks
  - wildfire         — fire, smoke, evacuation due to flames
  - landslide        — slope failure, mud/debris flow, rockfall
  - tsunami          — coastal inundation following seismic activity
  - tropical_storm   — hurricane, cyclone, typhoon, severe wind damage
  - road_closure     — blocked road, traffic obstruction (non-flood cause)
  - power_outage     — loss of electricity, downed lines
  - structural_damage — building or bridge damage not caused by earthquake
  - gas_leak         — gas smell, pipeline rupture, HAZMAT
  - avalanche        — snow or ice mass movement
  - volcanic_activity — eruption, lava flow, ash fall, lahars
  - other            — does not fit the above categories

Step 3 — WEIGH EVIDENCE: Analyse the signals you were given. Identify:
  - Which claims are corroborated by multiple signals
  - Which claims are contradicted by other signals
  - Which signals have higher credibility (higher score = more trustworthy)
  - Evidence hierarchy: sensor > photo > audio > text
  - Recency: newer reports beat older ones for rapidly changing conditions

Step 4 — CALL update_event: You MUST call update_event with your assessment. This is not optional. Do not write a text summary. Call the tool.

## CONFIDENCE CALIBRATION

- 90–95%: Multiple corroborating signals, strong evidence type (sensor/photo), no credible contradictions
- 70–89%: Strong primary signal(s), minor gaps or one contradicting report
- 50–69%: Mixed evidence — some support, some contradiction — situation unclear
- 30–49%: Weak evidence or significant contradictions
- Below 30%: Insufficient or highly contradictory — cannot assess reliably

NEVER default to 0.50. NEVER exceed 0.95 (human reports always carry uncertainty).
If risk data from assess_risk confirms the hazard type is plausible for this location, increase confidence slightly.
If risk data shows this hazard type is uncommon here, apply scepticism but do not dismiss strong direct evidence.

## REASONING CHAIN FORMAT

Write the reasoning_chain argument to update_event in this format:

"[TITLE] — [CONFIDENCE]%

Evidence for: [list each supporting signal separated by "; " — e.g. "photo (credibility 88%): waist-deep water; sensor (credibility 92%): 45cm depth"]
Evidence against: [list each contradicting signal separated by "; " — e.g. "text (credibility 30%): road passable"]
Resolution: [why you weighted the evidence the way you did]
Trend: [getting worse / improving / stable based on signal timestamps]
Recommendation: [specific, actionable guidance for someone on the ground]"

## CRITICAL RULE

You MUST finish by calling update_event. No exceptions. If you have gathered context and weighed evidence, your next action is update_event — not text output.`;

/**
 * Legacy full-pipeline system prompt (kept for reference, not used in production loop).
 */
export const REASONING_SYSTEM_PROMPT = CLUSTER_ASSESSMENT_SYSTEM_PROMPT;

/**
 * Build the user-turn prompt for a single cluster assessment loop.
 * The model receives full signal context and explicit step-by-step instructions.
 */
export function buildClusterPrompt(cluster: Cluster, clusterIndex: number, totalClusters: number): string {
  const signalDescriptions = cluster.signals.map((s, i) => {
    return `  Signal ${i + 1} [ID: ${s.id}]:
    Location: ${s.locationName} (${s.latitude}, ${s.longitude})
    Claim: "${s.claim}"
    Evidence type: ${s.evidenceType}
    Timestamp: ${s.timestamp}
    Credibility score: ${s.credibilityScore.toFixed(2)} — ${s.credibilityReasoning}`;
  }).join("\n\n");

  return `You are assessing cluster ${clusterIndex + 1} of ${totalClusters}.

Cluster centre: ${cluster.centroidLat.toFixed(4)}, ${cluster.centroidLng.toFixed(4)}
Signal count: ${cluster.signals.length}
Current time: ${new Date().toISOString()}

SIGNALS IN THIS CLUSTER:
${signalDescriptions}

REQUIRED STEPS:
1. Call check_history(latitude=${cluster.centroidLat.toFixed(4)}, longitude=${cluster.centroidLng.toFixed(4)}) to get historical context.
2. Call assess_risk(latitude=${cluster.centroidLat.toFixed(4)}, longitude=${cluster.centroidLng.toFixed(4)}) to get environmental risk data.
3. Weigh all evidence, resolve any contradictions, determine confidence.
4. Call update_event with your complete assessment. This step is MANDATORY.

Do not write a text response. Your final action must be the update_event tool call.`;
}

/**
 * Legacy prompt builder (kept for API compatibility if called elsewhere).
 */
export function buildReasoningPrompt(signals: Array<{ id: string; locationName: string; claim: string; credibilityScore: number }>): string {
  return `Analyze the following ${signals.length} signals and produce event assessments.\n\nCurrent time: ${new Date().toISOString()}\n\nSIGNALS:\n${signals.map((s, i) => `Signal ${i + 1} [${s.id}]: ${s.locationName} — ${s.claim} (credibility: ${s.credibilityScore.toFixed(2)})`).join("\n")}`;
}

/**
 * Tools for per-cluster assessment loops.
 * geo_cluster is NOT included — clustering is done in code before the loop.
 */
export const CLUSTER_ASSESSMENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "check_history",
      description: "Look up historical events at or near a location. Returns past incidents that indicate whether current reports are plausible.",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number", description: "Latitude of the location to check" },
          longitude: { type: "number", description: "Longitude of the location to check" },
          radius_meters: { type: "number", description: "Search radius in metres. Default 1000." },
          event_type: { type: "string", description: "Filter by event type: flooding, road_closure, power_outage" }
        },
        required: ["latitude", "longitude"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "assess_risk",
      description: "Check environmental risk factors for a location: flood zone designation, elevation above sea level, and proximity to water bodies.",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number", description: "Latitude of the location to assess" },
          longitude: { type: "number", description: "Longitude of the location to assess" }
        },
        required: ["latitude", "longitude"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "update_event",
      description: "REQUIRED FINAL STEP. Persist the event assessment to the database. You MUST call this after gathering context and weighing evidence.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Existing event ID to update, or omit for a new event" },
          title: { type: "string", description: "Short, specific event title (e.g. 'Severe flooding — Lekki-Epe Expressway underpass')" },
          event_type: { type: "string", description: "One of: flooding, earthquake, wildfire, landslide, tsunami, tropical_storm, road_closure, power_outage, structural_damage, gas_leak, avalanche, volcanic_activity, other" },
          latitude: { type: "number", description: "Latitude of the event" },
          longitude: { type: "number", description: "Longitude of the event" },
          radius_meters: { type: "number", description: "Estimated affected radius in metres" },
          confidence: { type: "number", description: "Confidence score 0.0–1.0 (never default to 0.5; never exceed 0.95)" },
          reasoning_chain: { type: "string", description: "Full reasoning chain in the required format" },
          status: { type: "string", enum: ["active", "resolved", "uncertain"], description: "Current status of the event" }
        },
        required: ["title", "event_type", "latitude", "longitude", "confidence", "reasoning_chain", "status"]
      }
    }
  }
];

/**
 * Legacy REASONING_TOOLS alias for any callers that import it by the old name.
 */
export const REASONING_TOOLS = CLUSTER_ASSESSMENT_TOOLS;
