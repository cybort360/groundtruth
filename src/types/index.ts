/**
 * All supported event types.
 * The system is scenario-agnostic — any hazard that produces localised signals
 * can be assessed. "flooding" is the primary demo type for the hackathon.
 */
export type EventType =
  | "flooding"
  | "earthquake"
  | "wildfire"
  | "landslide"
  | "tsunami"
  | "tropical_storm"
  | "road_closure"
  | "power_outage"
  | "structural_damage"
  | "gas_leak"
  | "avalanche"
  | "volcanic_activity"
  | "other";

export interface Report {
  id: string;
  type: "photo" | "voice" | "text" | "sensor";
  rawContent?: string;
  imageBase64?: string;
  audioBase64?: string;
  latitude: number;
  longitude: number;
  submittedAt: string;
  submitterId?: string;
}

export interface NormalizedSignal {
  id: string;
  reportId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  claim: string;
  evidenceType: "photo" | "audio" | "text" | "sensor";
  timestamp: string;
  severity: number;
  details: string;
  isFirsthand: boolean;
  credibilityScore: number;
  credibilityReasoning: string;
}

export interface AssessedEvent {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  confidence: number;
  reasoningChain: string;
  status: "active" | "resolved" | "uncertain";
  firstReported: string;
  lastUpdated: string;
  signalCount: number;
  signals: NormalizedSignal[];
  conflicts: ConflictPair[];
}

export interface ConflictPair {
  signalA: NormalizedSignal;
  signalB: NormalizedSignal;
  conflictType: "contradictory_claims" | "inconsistent_severity" | "temporal_disagreement";
  resolution: string;
}

export interface GemmaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[]; // base64 encoded
  tool_calls?: GemmaToolCall[];
  tool_call_id?: string;
}

export interface GemmaToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ReasoningOutput {
  events: AssessedEvent[];
  signalsProcessed: number;
  conflictsDetected: number;
  thinkingTrace?: string;
}

export interface CredibilityResult {
  overallScore: number;
  recencyScore: number;
  evidenceScore: number;
  specificityScore: number;
  consistencyScore: number;
  reasoning: string;
}

export interface NormalizerResult {
  locationName: string;
  claim: string;
  evidenceType: "photo" | "audio" | "text" | "sensor";
  severity: number;
  details: string;
  isFirsthand: boolean;
  temporalIndicator: "current" | "recent" | "stale" | "unknown";
}
