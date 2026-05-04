/**
 * geo_cluster tool
 *
 * Groups signals by geographic proximity using simple distance calculation.
 * Returns clusters of signal IDs that likely refer to the same event.
 */

import { getAllSignals } from "../db";
import type { NormalizedSignal } from "@/types";

export interface ClusterSignal {
  id: string;
  claim: string;
  evidenceType: string;
  credibilityScore: number;
  credibilityReasoning: string;
  timestamp: string;
  locationName: string;
  latitude: number;
  longitude: number;
}

export interface Cluster {
  centroidLat: number;
  centroidLng: number;
  signalIds: string[];
  signals: ClusterSignal[];
}

export async function geoCluster(args: Record<string, unknown>): Promise<{
  clusters: Cluster[];
  totalSignals: number;
  totalClusters: number;
}> {
  const signalIds = args.signal_ids as string[] | undefined;
  const radiusMeters = (args.radius_meters as number) || 500;

  let signals = getAllSignals();

  // Filter to requested signal IDs if provided
  if (signalIds && signalIds.length > 0) {
    const idSet = new Set(signalIds);
    signals = signals.filter((s) => idSet.has(s.id));
  }

  const clusters = clusterByDistance(signals, radiusMeters);

  return {
    clusters: clusters.map((c) => ({
      centroidLat: c.centroidLat,
      centroidLng: c.centroidLng,
      signalIds: c.signals.map((s) => s.id),
      signals: c.signals.map((s) => ({
        id: s.id,
        claim: s.claim,
        evidenceType: s.evidenceType,
        credibilityScore: s.credibilityScore,
        credibilityReasoning: s.credibilityReasoning,
        timestamp: s.timestamp,
        locationName: s.locationName,
        latitude: s.latitude,
        longitude: s.longitude,
      })),
    })),
    totalSignals: signals.length,
    totalClusters: clusters.length,
  };
}

interface InternalCluster {
  centroidLat: number;
  centroidLng: number;
  signals: NormalizedSignal[];
}

function clusterByDistance(
  signals: NormalizedSignal[],
  radiusMeters: number
): InternalCluster[] {
  const clusters: InternalCluster[] = [];
  const assigned = new Set<string>();

  for (const signal of signals) {
    if (assigned.has(signal.id)) continue;

    // Find existing cluster within radius
    let foundCluster: InternalCluster | null = null;
    for (const cluster of clusters) {
      const dist = haversineDistance(
        signal.latitude,
        signal.longitude,
        cluster.centroidLat,
        cluster.centroidLng
      );
      if (dist <= radiusMeters) {
        foundCluster = cluster;
        break;
      }
    }

    if (foundCluster) {
      foundCluster.signals.push(signal);
      // Recalculate centroid
      const lats = foundCluster.signals.map((s) => s.latitude);
      const lngs = foundCluster.signals.map((s) => s.longitude);
      foundCluster.centroidLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      foundCluster.centroidLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    } else {
      clusters.push({
        centroidLat: signal.latitude,
        centroidLng: signal.longitude,
        signals: [signal],
      });
    }

    assigned.add(signal.id);
  }

  return clusters;
}

/**
 * Calculate distance between two points in meters using Haversine formula.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
