/**
 * assess_risk tool
 *
 * Checks environmental risk factors for a location:
 * elevation, proximity to water, drainage quality, and known hazard types.
 *
 * Uses a local JSON file for demo scenarios. For any location outside the
 * pre-loaded data, returns an "unknown" response — the reasoning engine
 * treats unknown risk as neutral (neither supporting nor contradicting reports).
 *
 * In a production deployment this would query elevation APIs (e.g. Open-Elevation),
 * FEMA flood zone maps, global wildfire risk databases, seismic hazard maps, etc.
 * The tool interface is intentionally generic so those backends can be swapped in
 * without changing the reasoning layer.
 */

import fs from "fs";
import path from "path";

interface RiskZone {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  riskLevel: "high" | "moderate" | "low";
  elevation: number; // metres above sea level
  nearestWater: string;
  waterDistanceMeters: number;
  drainageQuality: "poor" | "moderate" | "good";
  hazardTypes: string[]; // which hazard types this zone is relevant for
  notes: string;
}

let riskZoneData: RiskZone[] | null = null;

function loadRiskZones(): RiskZone[] {
  if (riskZoneData) return riskZoneData;

  const filePath = path.join(process.cwd(), "data", "risk-zones.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    riskZoneData = JSON.parse(raw) as RiskZone[];
    return riskZoneData;
  } catch {
    riskZoneData = [];
    return riskZoneData;
  }
}

export async function assessRisk(args: Record<string, unknown>): Promise<{
  riskLevel: string;
  elevation: number | null;
  zoneName: string | null;
  nearestWater: string | null;
  waterDistanceMeters: number | null;
  drainageQuality: string | null;
  knownHazardTypes: string[];
  summary: string;
}> {
  const lat = args.latitude as number;
  const lng = args.longitude as number;

  const zones = loadRiskZones();

  // Find the closest matching risk zone within its declared radius
  let closestZone: RiskZone | null = null;
  let closestDistance = Infinity;

  for (const zone of zones) {
    const dist = haversineDistance(lat, lng, zone.latitude, zone.longitude);
    if (dist < closestDistance && dist <= zone.radiusMeters) {
      closestZone = zone;
      closestDistance = dist;
    }
  }

  if (closestZone) {
    return {
      riskLevel: closestZone.riskLevel,
      elevation: closestZone.elevation,
      zoneName: closestZone.name,
      nearestWater: closestZone.nearestWater,
      waterDistanceMeters: closestZone.waterDistanceMeters,
      drainageQuality: closestZone.drainageQuality,
      knownHazardTypes: closestZone.hazardTypes,
      summary: `Location is in ${closestZone.name} (${closestZone.riskLevel} risk). ` +
        `Elevation: ${closestZone.elevation}m above sea level. ` +
        `Nearest water: ${closestZone.nearestWater} (${closestZone.waterDistanceMeters}m). ` +
        `Drainage quality: ${closestZone.drainageQuality}. ` +
        `Known hazard types: ${closestZone.hazardTypes.join(", ")}. ` +
        closestZone.notes,
    };
  }

  // No pre-loaded data for this location — neutral response.
  // The reasoning engine should treat this as "risk unknown" not "risk low".
  return {
    riskLevel: "unknown",
    elevation: null,
    zoneName: null,
    nearestWater: null,
    waterDistanceMeters: null,
    drainageQuality: null,
    knownHazardTypes: [],
    summary: "No pre-loaded risk zone data for this location. " +
      "Risk level is unknown — treat reported conditions at face value based on signal evidence alone. " +
      "In production, this would query global elevation, flood zone, seismic, and wildfire risk APIs.",
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
