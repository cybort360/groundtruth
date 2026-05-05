/**
 * Complexity Router
 *
 * Decides whether a signal cluster should be assessed by the small local model
 * (Gemma E4B via Ollama) or escalated to the large cloud model (Gemma 27B via
 * Google API).
 *
 * "High Complexity Conflict" triggers cloud escalation when ALL of the
 * following conditions hold in "auto" backend mode:
 *   1. Three or more conflicting reports exist in the cluster, AND
 *   2. GPS positions are spread > 200 m apart  (different location claims), OR
 *      Severity disagreement of ≥ 2 across signals,                         OR
 *      Cluster contains 5+ signals (high-volume, requires stronger synthesis)
 *
 * When the backend setting is explicitly "ollama" or "google", routing
 * is bypassed — the explicit choice always wins.
 */

import type { NormalizedSignal } from "@/types";
import type { BackendType } from "./gemma-backends/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComplexityAssessment {
  /** "simple" → handle locally; "complex" → escalate to cloud. */
  level: "simple" | "complex";
  /** Human-readable explanations for why this cluster is complex. */
  reasons: string[];
  signalCount: number;
  /** Maximum pairwise GPS distance between any two signals (metres). */
  gpsSpreadMeters: number;
  /** Max severity minus min severity across signals. */
  severityRange: number;
}

// ── Geometry ──────────────────────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lng points. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Maximum pairwise distance across all signals in a cluster (metres). */
function maxGpsSpread(
  signals: { latitude: number; longitude: number }[],
): number {
  let max = 0;
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const d = haversineMeters(
        signals[i].latitude,
        signals[i].longitude,
        signals[j].latitude,
        signals[j].longitude,
      );
      if (d > max) max = d;
    }
  }
  return max;
}

// ── Complexity assessment ─────────────────────────────────────────────────────

const GPS_SPREAD_THRESHOLD_M = 200; // conflicting location claims
const SEVERITY_RANGE_THRESHOLD = 2; // e.g. one says "minor", another says "critical"
const HIGH_VOLUME_THRESHOLD    = 5; // large clusters benefit from the stronger model

export function assessClusterComplexity(
  signals: (Pick<NormalizedSignal, "latitude" | "longitude"> & { severity?: number })[],
): ComplexityAssessment {
  const signalCount      = signals.length;
  const gpsSpreadMeters  = maxGpsSpread(signals);
  const severities       = signals.map((s) => s.severity ?? 1).filter((v) => v > 0);
  const severityRange    =
    severities.length > 1
      ? Math.max(...severities) - Math.min(...severities)
      : 0;

  const reasons: string[] = [];

  if (signalCount >= 3 && gpsSpreadMeters > GPS_SPREAD_THRESHOLD_M) {
    reasons.push(
      `${signalCount} reports with conflicting GPS positions (spread: ${Math.round(gpsSpreadMeters)} m)`,
    );
  }
  if (severityRange >= SEVERITY_RANGE_THRESHOLD) {
    reasons.push(`Severity disagreement across reports (range: ${severityRange})`);
  }
  if (signalCount >= HIGH_VOLUME_THRESHOLD) {
    reasons.push(`High-volume cluster (${signalCount} signals)`);
  }

  return {
    level: reasons.length > 0 ? "complex" : "simple",
    reasons,
    signalCount,
    gpsSpreadMeters,
    severityRange,
  };
}

// ── Backend selector ──────────────────────────────────────────────────────────

/**
 * Given a complexity assessment and the user's backend setting, return which
 * concrete backend type should handle this cluster.
 *
 * "auto" → complex clusters → cloud; simple clusters → local.
 * Explicit "ollama" or "google" → always use that backend regardless.
 */
export function routeBackendType(
  complexity: ComplexityAssessment,
  setting: BackendType,
): "ollama" | "google" {
  if (setting === "ollama") return "ollama";
  if (setting === "google") return "google";
  return complexity.level === "complex" ? "google" : "ollama";
}

/** Short label for UI display (e.g. on EventCard badge). */
export function assessedByLabel(backendType: "ollama" | "google"): string {
  return backendType === "google" ? "cloud" : "local";
}
