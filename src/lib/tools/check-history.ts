/**
 * check_history tool
 *
 * Looks up historical events at or near a location.
 * Returns past incidents that help the reasoning engine determine
 * if current reports are plausible.
 *
 * Uses a local JSON file for the demo. In production, this would
 * query a database of historical disaster data.
 */

import fs from "fs";
import path from "path";

interface HistoricalEvent {
  date: string;
  eventType: string;
  location: string;
  latitude: number;
  longitude: number;
  severity: string;
  description: string;
}

let historyData: HistoricalEvent[] | null = null;

function loadHistory(): HistoricalEvent[] {
  if (historyData) return historyData;

  const filePath = path.join(process.cwd(), "data", "history.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    historyData = JSON.parse(raw);
    return historyData!;
  } catch {
    // Return empty if file doesn't exist yet
    historyData = [];
    return historyData;
  }
}

export async function checkHistory(args: Record<string, unknown>): Promise<{
  eventsFound: number;
  events: Array<{
    date: string;
    eventType: string;
    severity: string;
    description: string;
    distanceMeters: number;
  }>;
  riskAssessment: string;
}> {
  const lat = args.latitude as number;
  const lng = args.longitude as number;
  const radius = (args.radius_meters as number) || 1000;
  const eventType = args.event_type as string | undefined;

  const history = loadHistory();

  const nearby = history
    .filter((h) => {
      const dist = haversineDistance(lat, lng, h.latitude, h.longitude);
      if (dist > radius) return false;
      if (eventType && h.eventType !== eventType) return false;
      return true;
    })
    .map((h) => ({
      date: h.date,
      eventType: h.eventType,
      severity: h.severity,
      description: h.description,
      distanceMeters: Math.round(haversineDistance(lat, lng, h.latitude, h.longitude)),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10); // Max 10 results

  let riskAssessment = "No historical events found at this location.";
  if (nearby.length >= 5) {
    riskAssessment = `High historical frequency: ${nearby.length} past events within ${radius}m. This location has a pattern of ${eventType || "incidents"}.`;
  } else if (nearby.length >= 2) {
    riskAssessment = `Moderate historical frequency: ${nearby.length} past events within ${radius}m. Current reports are consistent with historical patterns.`;
  } else if (nearby.length === 1) {
    riskAssessment = `Low historical frequency: 1 past event within ${radius}m. Location has experienced this before but it is uncommon.`;
  }

  return {
    eventsFound: nearby.length,
    events: nearby,
    riskAssessment,
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
